import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, run, update, batchUpsertWords } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// 词库配置 - 与转换脚本保持一致
const DICTIONARY_CONFIG: Record<string, { name: string; description: string }> = {
    'xiaoxue': { name: '小学英语', description: '小学英语词汇（人教版3-6年级）' },
    'chuzhong': { name: '初中英语', description: '初中英语词汇（含人教版、外研社版）' },
    'gaozhong': { name: '高中英语', description: '高中英语词汇（含人教版、北师大版）' },
    'cet4': { name: 'CET-4 大学英语四级', description: '大学英语四级核心词汇' },
    'cet6': { name: 'CET-6 大学英语六级', description: '大学英语六级核心词汇' },
    'kaoyan': { name: '考研英语', description: '考研英语核心词汇' },
    'level4': { name: '专四', description: '英语专业四级词汇' },
    'level8': { name: '专八', description: '英语专业八级词汇' },
    'toefl': { name: 'TOEFL 托福', description: '托福考试核心词汇' },
    'ielts': { name: 'IELTS 雅思', description: '雅思考试核心词汇' },
    'gre': { name: 'GRE', description: 'GRE考试核心词汇' },
    'gmat': { name: 'GMAT', description: 'GMAT考试核心词汇' },
    'sat': { name: 'SAT', description: 'SAT考试核心词汇' },
    'bec': { name: 'BEC 商务英语', description: '商务英语证书考试词汇' }
};

// 获取词库目录路径
function getDictionaryDir(): string {
    // Docker 环境下词库放在 /app/data/dictionary/merged
    // 本地开发时放在项目的 data/dictionary/merged
    const possiblePaths = [
        path.join(process.cwd(), 'data', 'dictionary', 'merged'),
        path.join(__dirname, '../../..', 'data', 'dictionary', 'merged'),
        '/app/data/dictionary/merged'
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    return possiblePaths[0]; // 默认返回第一个
}

/**
 * GET /words - 获取用户的单词本
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { masteryLevel, limit = '100', offset = '0' } = req.query;

        let sql = 'SELECT * FROM word_book WHERE user_id = ?';
        const params: any[] = [userId];

        if (masteryLevel !== undefined) {
            sql += ' AND mastery_level = ?';
            params.push(parseInt(masteryLevel as string));
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit as string), parseInt(offset as string));

        const words = query(sql, params);
        res.json(words);
    } catch (error) {
        console.error('Get words error:', error);
        res.status(500).json({ error: '获取单词本失败' });
    }
});

/**
 * POST /words - 添加单词到单词本
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { word, phonetic, translation, context, contextTranslation, definitions } = req.body;

        if (!word) {
            return res.status(400).json({ error: '请提供单词' });
        }

        const existing = queryOne(
            'SELECT id FROM word_book WHERE user_id = ? AND word = ?',
            [userId, word.toLowerCase()]
        );

        if (existing) {
            return res.status(409).json({ error: '该单词已在单词本中' });
        }

        const id = uuidv4();
        run(
            `INSERT INTO word_book (id, user_id, word, phonetic, translation, context, context_translation, definitions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, userId, word.toLowerCase(), phonetic || null, translation || null, context || null, contextTranslation || null, JSON.stringify(definitions || [])]
        );

        // 更新用户统计
        update('UPDATE user_statistics SET total_words_learned = total_words_learned + 1 WHERE user_id = ?', [userId]);

        const entry = queryOne('SELECT * FROM word_book WHERE id = ?', [id]);
        res.status(201).json(entry);
    } catch (error) {
        console.error('Add word error:', error);
        res.status(500).json({ error: '添加单词失败' });
    }
});

/**
 * PUT /words/:id - 更新单词
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const { phonetic, translation, masteryLevel, definitions } = req.body;

        const updates: string[] = [];
        const params: any[] = [];

        if (phonetic !== undefined) { updates.push('phonetic = ?'); params.push(phonetic); }
        if (translation !== undefined) { updates.push('translation = ?'); params.push(translation); }
        if (masteryLevel !== undefined) { updates.push('mastery_level = ?'); params.push(masteryLevel); }
        if (definitions !== undefined) { updates.push('definitions = ?'); params.push(JSON.stringify(definitions)); }

        if (updates.length === 0) {
            return res.status(400).json({ error: '没有要更新的字段' });
        }

        updates.push("reviewed_at = datetime('now')");
        params.push(id, userId);
        const result = update(`UPDATE word_book SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);

        if (result === 0) {
            return res.status(404).json({ error: '单词不存在' });
        }

        const entry = queryOne('SELECT * FROM word_book WHERE id = ?', [id]);
        res.json(entry);
    } catch (error) {
        console.error('Update word error:', error);
        res.status(500).json({ error: '更新单词失败' });
    }
});

/**
 * DELETE /words/:id - 删除单词
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;

        const result = update('DELETE FROM word_book WHERE id = ? AND user_id = ?', [id, userId]);

        if (result === 0) {
            return res.status(404).json({ error: '单词不存在' });
        }

        res.json({ message: '单词已删除' });
    } catch (error) {
        console.error('Delete word error:', error);
        res.status(500).json({ error: '删除单词失败' });
    }
});

/**
 * GET /words/cache/:word - 从缓存查询单词
 */
router.get('/cache/:word', async (req: Request, res: Response) => {
    try {
        const { word } = req.params;
        const cached = queryOne('SELECT * FROM word_cache WHERE word = ?', [word.toLowerCase()]);

        if (!cached) {
            return res.status(404).json({ error: '单词未缓存' });
        }

        res.json(cached);
    } catch (error) {
        console.error('Get word cache error:', error);
        res.status(500).json({ error: '查询单词缓存失败' });
    }
});

/**
 * POST /words/cache - 缓存单词
 */
router.post('/cache', async (req: Request, res: Response) => {
    try {
        const { word, phonetic, translation, definitions } = req.body;

        if (!word) {
            return res.status(400).json({ error: '请提供单词' });
        }

        const existing = queryOne('SELECT id FROM word_cache WHERE word = ?', [word.toLowerCase()]);

        if (existing) {
            update(
                `UPDATE word_cache SET phonetic = ?, translation = ?, definitions = ?, updated_at = datetime('now') WHERE word = ?`,
                [phonetic || null, translation || null, JSON.stringify(definitions || []), word.toLowerCase()]
            );
        } else {
            run(
                `INSERT INTO word_cache (id, word, phonetic, translation, definitions) VALUES (?, ?, ?, ?, ?)`,
                [uuidv4(), word.toLowerCase(), phonetic || null, translation || null, JSON.stringify(definitions || [])]
            );
        }

        res.json({ message: '单词已缓存' });
    } catch (error) {
        console.error('Cache word error:', error);
        res.status(500).json({ error: '缓存单词失败' });
    }
});

/**
 * POST /words/import - 批量导入词库 (管理员)
 */
router.post('/import', authMiddleware, async (req: Request, res: Response) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: '需要管理员权限' });
        }

        const { words } = req.body;

        if (!Array.isArray(words) || words.length === 0) {
            return res.status(400).json({ error: '请提供单词数组' });
        }

        let imported = 0;
        for (const w of words) {
            if (w.word) {
                try {
                    const existing = queryOne('SELECT id FROM word_cache WHERE word = ?', [w.word.toLowerCase()]);
                    if (existing) {
                        update(
                            `UPDATE word_cache SET phonetic = ?, translation = ?, definitions = ? WHERE word = ?`,
                            [w.phonetic || null, w.translation || null, JSON.stringify(w.definitions || []), w.word.toLowerCase()]
                        );
                    } else {
                        run(
                            `INSERT INTO word_cache (id, word, phonetic, translation, definitions) VALUES (?, ?, ?, ?, ?)`,
                            [uuidv4(), w.word.toLowerCase(), w.phonetic || null, w.translation || null, JSON.stringify(w.definitions || [])]
                        );
                    }
                    imported++;
                } catch (e) {
                    // 忽略单个错误
                }
            }
        }

        res.json({ message: `成功导入 ${imported} 个单词`, imported });
    } catch (error) {
        console.error('Import words error:', error);
        res.status(500).json({ error: '导入词库失败' });
    }
});

/**
 * GET /words/stats - 获取词库统计信息 (管理员)
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: '需要管理员权限' });
        }

        const totalWords = queryOne('SELECT COUNT(*) as count FROM word_cache', []);
        const withPhonetic = queryOne('SELECT COUNT(*) as count FROM word_cache WHERE phonetic IS NOT NULL AND phonetic != ""', []);
        const withTranslation = queryOne('SELECT COUNT(*) as count FROM word_cache WHERE translation IS NOT NULL AND translation != ""', []);
        const withDefinitions = queryOne('SELECT COUNT(*) as count FROM word_cache WHERE definitions IS NOT NULL AND definitions != "[]"', []);

        res.json({
            totalWords: totalWords?.count || 0,
            withPhonetic: withPhonetic?.count || 0,
            withTranslation: withTranslation?.count || 0,
            withDefinitions: withDefinitions?.count || 0,
        });
    } catch (error) {
        console.error('Get words stats error:', error);
        res.status(500).json({ error: '获取词库统计失败' });
    }
});

/**
 * POST /words/import-dictionary - 导入预置词库 (管理员)
 */
router.post('/import-dictionary', authMiddleware, async (req: Request, res: Response) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: '需要管理员权限' });
        }

        const { dictionary, action } = req.body;
        const dictDir = getDictionaryDir();

        // 如果是导入全部
        if (action === 'import-all' || dictionary === 'all') {
            let totalProcessed = 0;
            const results: any[] = [];

            for (const [key, config] of Object.entries(DICTIONARY_CONFIG)) {
                const filePath = path.join(dictDir, `${key}.json`);
                if (fs.existsSync(filePath)) {
                    const imported = await importDictionaryFile(filePath);
                    totalProcessed += imported;
                    results.push({ dictionary: key, name: config.name, processed: imported });
                }
            }

            // 查询数据库中实际的唯一单词数
            const dbStats = queryOne<any>('SELECT COUNT(*) as count FROM word_cache');
            const uniqueWords = dbStats?.count || 0;

            return res.json({
                message: `处理完成！共处理 ${totalProcessed} 条记录，数据库中有 ${uniqueWords} 个唯一单词`,
                totalProcessed,
                uniqueWords,
                results
            });
        }

        // 导入单个词库
        if (!dictionary || !DICTIONARY_CONFIG[dictionary]) {
            return res.status(400).json({ error: '无效的词库名称' });
        }

        const filePath = path.join(dictDir, `${dictionary}.json`);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: '词库文件不存在，请确保已复制词库文件到 data/dictionary/merged 目录' });
        }

        const imported = await importDictionaryFile(filePath);
        res.json({
            message: `成功导入 ${imported} 个单词`,
            dictionary,
            name: DICTIONARY_CONFIG[dictionary].name,
            imported
        });
    } catch (error) {
        console.error('Import dictionary error:', error);
        res.status(500).json({ error: '导入词库失败' });
    }
});

/**
 * 从文件导入词库（使用批量事务优化）
 */
async function importDictionaryFile(filePath: string): Promise<number> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const words = JSON.parse(content);

    // 准备批量导入数据
    const wordsToImport: Array<{
        id: string;
        word: string;
        phonetic: string | null;
        translation: string | null;
        definitions: any[];
    }> = [];

    for (const w of words) {
        if (w.word && typeof w.word === 'string') {
            wordsToImport.push({
                id: uuidv4(),
                word: w.word,
                phonetic: w.phonetic || null,
                translation: w.translation || null,
                definitions: w.definitions || []
            });
        }
    }

    // 使用批量事务导入
    if (wordsToImport.length > 0) {
        return batchUpsertWords(wordsToImport);
    }

    return 0;
}

/**
 * GET /words/dictionaries - 获取可用词库列表 (管理员)
 */
router.get('/dictionaries', authMiddleware, async (req: Request, res: Response) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: '需要管理员权限' });
        }

        const dictDir = getDictionaryDir();
        const dictionaries: any[] = [];

        for (const [key, config] of Object.entries(DICTIONARY_CONFIG)) {
            const filePath = path.join(dictDir, `${key}.json`);
            let wordCount = 0;
            let available = false;

            if (fs.existsSync(filePath)) {
                available = true;
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const words = JSON.parse(content);
                    wordCount = Array.isArray(words) ? words.length : 0;
                } catch {
                    wordCount = 0;
                }
            }

            dictionaries.push({
                id: key,
                name: config.name,
                description: config.description,
                wordCount,
                available
            });
        }

        res.json(dictionaries);
    } catch (error) {
        console.error('Get dictionaries error:', error);
        res.status(500).json({ error: '获取词库列表失败' });
    }
});

export default router;
