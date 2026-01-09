import { Router, Request, Response } from 'express';
import { query, queryOne, run, update } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import axios from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /translate - 翻译文本
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { text, from = 'en', to = 'zh', provider: preferredProvider } = req.body;

        if (!text) {
            return res.status(400).json({ error: '请提供要翻译的文本' });
        }

        let sql = 'SELECT * FROM translation_providers WHERE is_active = 1';
        if (preferredProvider) { sql += ` AND provider_type = '${preferredProvider}'`; }
        sql += ' ORDER BY is_default DESC LIMIT 1';

        const provider = queryOne<any>(sql);

        if (!provider) {
            return res.status(503).json({ error: '没有可用的翻译服务' });
        }

        let translation = '';

        try {
            switch (provider.provider_type) {
                case 'baidu':
                    translation = await translateWithBaidu(text, from, to, provider);
                    break;
                case 'openai':
                    translation = await translateWithOpenAI(text, from, to, provider);
                    break;
                default:
                    return res.status(400).json({ error: `不支持的翻译供应商: ${provider.provider_type}` });
            }
        } catch (error: any) {
            console.error(`Translation with ${provider.provider_type} failed:`, error);
            return res.status(500).json({ error: '翻译失败: ' + (error.message || '未知错误') });
        }

        res.json({ translation, provider: provider.provider_type });
    } catch (error) {
        console.error('Translate error:', error);
        res.status(500).json({ error: '翻译服务错误' });
    }
});

/**
 * GET /translate/providers - 获取翻译供应商列表 (管理员)
 */
router.get('/providers', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const providers = query(
            'SELECT id, name, provider_type, app_id, is_active, is_default, created_at FROM translation_providers ORDER BY created_at DESC'
        );
        res.json(providers);
    } catch (error) {
        console.error('Get translation providers error:', error);
        res.status(500).json({ error: '获取翻译供应商列表失败' });
    }
});

/**
 * POST /translate/providers - 创建翻译供应商 (管理员)
 */
router.post('/providers', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { name, providerType, appId, apiKey, apiSecret, isDefault } = req.body;

        if (!name || !providerType || !apiKey) {
            return res.status(400).json({ error: '请提供必要的参数' });
        }

        const id = uuidv4();
        if (isDefault) { update('UPDATE translation_providers SET is_default = 0', []); }

        run(
            `INSERT INTO translation_providers (id, name, provider_type, app_id, api_key, api_secret, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, name, providerType, appId || null, apiKey, apiSecret || null, isDefault ? 1 : 0]
        );

        const provider = queryOne('SELECT * FROM translation_providers WHERE id = ?', [id]);
        res.status(201).json(provider);
    } catch (error) {
        console.error('Create translation provider error:', error);
        res.status(500).json({ error: '创建翻译供应商失败' });
    }
});

/**
 * DELETE /translate/providers/:id - 删除翻译供应商 (管理员)
 */
router.delete('/providers/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        update('DELETE FROM translation_providers WHERE id = ?', [id]);
        res.json({ message: '翻译供应商已删除' });
    } catch (error) {
        console.error('Delete translation provider error:', error);
        res.status(500).json({ error: '删除翻译供应商失败' });
    }
});

/**
 * PUT /translate/providers/:id - 更新翻译供应商 (管理员)
 */
router.put('/providers/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, providerType, appId, apiKey, apiSecret, isActive } = req.body;

        const updates: string[] = [];
        const params: any[] = [];

        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (providerType !== undefined) { updates.push('provider_type = ?'); params.push(providerType); }
        if (appId !== undefined) { updates.push('app_id = ?'); params.push(appId || null); }
        if (apiKey) { updates.push('api_key = ?'); params.push(apiKey); }
        if (apiSecret) { updates.push('api_secret = ?'); params.push(apiSecret); }
        if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: '没有要更新的字段' });
        }

        params.push(id);
        update(`UPDATE translation_providers SET ${updates.join(', ')} WHERE id = ?`, params);

        const provider = queryOne('SELECT * FROM translation_providers WHERE id = ?', [id]);
        res.json(provider);
    } catch (error) {
        console.error('Update translation provider error:', error);
        res.status(500).json({ error: '更新翻译供应商失败' });
    }
});

/**
 * PUT /translate/providers/:id/default - 设置默认翻译供应商 (管理员)
 */
router.put('/providers/:id/default', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // 先取消所有默认
        update('UPDATE translation_providers SET is_default = 0', []);
        // 设置新默认
        update('UPDATE translation_providers SET is_default = 1 WHERE id = ?', [id]);

        res.json({ message: '已设为默认' });
    } catch (error) {
        console.error('Set default translation provider error:', error);
        res.status(500).json({ error: '设置默认供应商失败' });
    }
});

// 百度翻译
async function translateWithBaidu(text: string, from: string, to: string, provider: any): Promise<string> {
    const appId = provider.app_id || process.env.BAIDU_APP_ID;
    const apiKey = provider.api_secret || process.env.BAIDU_API_KEY;

    if (!appId || !apiKey) { throw new Error('百度翻译配置缺失'); }

    const salt = Date.now().toString();
    const sign = crypto.createHash('md5').update(appId + text + salt + apiKey).digest('hex');

    const response = await axios.get('https://fanyi-api.baidu.com/api/trans/vip/translate', {
        params: { q: text, from, to, appid: appId, salt, sign }
    });

    if (response.data.error_code) { throw new Error(response.data.error_msg); }
    return response.data.trans_result?.[0]?.dst || '';
}

// OpenAI 翻译
async function translateWithOpenAI(text: string, from: string, to: string, provider: any): Promise<string> {
    const apiKey = provider.api_key || process.env.OPENAI_API_KEY;

    if (!apiKey) { throw new Error('OpenAI 配置缺失'); }

    const fromLang = from === 'en' ? 'English' : 'Chinese';
    const toLang = to === 'zh' ? 'Chinese' : 'English';

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: `You are a translator. Translate from ${fromLang} to ${toLang}. Only return the translation, nothing else.` },
                { role: 'user', content: text }
            ],
            temperature: 0.3
        },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    );

    return response.data.choices?.[0]?.message?.content?.trim() || '';
}

export default router;
