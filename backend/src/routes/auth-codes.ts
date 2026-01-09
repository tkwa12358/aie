import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, run, update } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { generateRandomCode } from '../utils/crypto';

const router = Router();

// 授权码类型配置（已移除旧版类型）
const CODE_TYPE_CONFIG: Record<string, { minutes: number; description: string; category: string }> = {
    'app_unlock': { minutes: 0, description: '应用解锁授权码', category: 'app' },
    'pro_10min': { minutes: 10, description: '专业评测10分钟', category: 'professional' },
    'pro_30min': { minutes: 30, description: '专业评测30分钟', category: 'professional' },
    'pro_60min': { minutes: 60, description: '专业评测60分钟', category: 'professional' }
};

/**
 * GET /auth-codes - 获取授权码列表 (管理员)
 */
router.get('/', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { codeType, isUsed, limit = '50', offset = '0' } = req.query;

        let sql = 'SELECT * FROM auth_codes WHERE 1=1';
        const params: any[] = [];

        if (codeType) { sql += ' AND code_type = ?'; params.push(codeType); }
        if (isUsed !== undefined) { sql += ' AND is_used = ?'; params.push(isUsed === 'true' ? 1 : 0); }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit as string), parseInt(offset as string));

        const codes = query(sql, params);
        res.json(codes);
    } catch (error) {
        console.error('Get auth codes error:', error);
        res.status(500).json({ error: '获取授权码列表失败' });
    }
});

/**
 * GET /auth-codes/types - 获取授权码类型列表
 */
router.get('/types', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const types = Object.entries(CODE_TYPE_CONFIG).map(([key, value]) => ({
            type: key,
            minutes: value.minutes,
            description: value.description,
            category: value.category
        }));
        res.json(types);
    } catch (error) {
        console.error('Get code types error:', error);
        res.status(500).json({ error: '获取授权码类型列表失败' });
    }
});

/**
 * POST /auth-codes/generate - 生成授权码 (管理员)
 */
router.post('/generate', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { codeType, count = 1, expiresInDays } = req.body;

        if (!codeType || !CODE_TYPE_CONFIG[codeType]) {
            return res.status(400).json({ error: '无效的授权码类型' });
        }

        const config = CODE_TYPE_CONFIG[codeType];
        const codes: any[] = [];
        const expiresAt = expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
            : null;

        for (let i = 0; i < Math.min(count, 100); i++) {
            const id = uuidv4();
            const code = generateRandomCode(8);

            run(
                `INSERT INTO auth_codes (id, code, code_type, minutes_amount, expires_at) VALUES (?, ?, ?, ?, ?)`,
                [id, code, codeType, config.minutes || null, expiresAt]
            );

            const authCode = queryOne('SELECT * FROM auth_codes WHERE id = ?', [id]);
            if (authCode) codes.push(authCode);
        }

        res.status(201).json({ codes, count: codes.length });
    } catch (error) {
        console.error('Generate auth codes error:', error);
        res.status(500).json({ error: '生成授权码失败' });
    }
});

/**
 * POST /auth-codes/redeem - 兑换授权码
 */
router.post('/redeem', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: '请提供授权码' });
        }

        const authCode = queryOne<any>('SELECT * FROM auth_codes WHERE code = ?', [code.toUpperCase()]);

        if (!authCode) {
            return res.status(404).json({ error: '授权码不存在' });
        }

        if (authCode.is_used) {
            return res.status(400).json({ error: '授权码已被使用' });
        }

        if (authCode.expires_at && new Date(authCode.expires_at) < new Date()) {
            return res.status(400).json({ error: '授权码已过期' });
        }

        update(
            "UPDATE auth_codes SET is_used = 1, used_by = ?, used_at = datetime('now') WHERE id = ?",
            [userId, authCode.id]
        );

        const codeType = authCode.code_type;
        const minutes = authCode.minutes_amount || CODE_TYPE_CONFIG[codeType]?.minutes || 0;

        // 根据不同授权码类型处理
        if (codeType === 'registration' || codeType === 'app_unlock') {
            // 应用解锁码，不需要添加额度
            res.json({
                message: '应用激活成功，您可以继续使用全部功能',
                codeType,
                activated: true
            });
        } else if (codeType.startsWith('pro_')) {
            update('UPDATE users SET professional_voice_minutes = professional_voice_minutes + ? WHERE id = ?', [minutes, userId]);
            res.json({ message: '授权码兑换成功', codeType, minutesAdded: minutes });
        } else if (codeType === '10min' || codeType === '60min') {
            update('UPDATE users SET voice_credits = voice_credits + ? WHERE id = ?', [minutes, userId]);
            res.json({ message: '授权码兑换成功', codeType, minutesAdded: minutes });
        } else {
            res.json({ message: '授权码兑换成功', codeType, minutesAdded: minutes });
        }
    } catch (error) {
        console.error('Redeem auth code error:', error);
        res.status(500).json({ error: '兑换授权码失败' });
    }
});

/**
 * GET /auth-codes/my - 获取当前用户的授权码
 */
router.get('/my', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;

        const codes = query(
            'SELECT * FROM auth_codes WHERE used_by = ? ORDER BY used_at DESC',
            [userId]
        );

        res.json(codes);
    } catch (error) {
        console.error('Get my auth codes error:', error);
        res.status(500).json({ error: '获取授权码失败' });
    }
});

/**
 * DELETE /auth-codes/:id - 删除授权码 (管理员)
 */
router.delete('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = update('DELETE FROM auth_codes WHERE id = ?', [id]);

        if (result === 0) {
            return res.status(404).json({ error: '授权码不存在' });
        }

        res.json({ message: '授权码已删除' });
    } catch (error) {
        console.error('Delete auth code error:', error);
        res.status(500).json({ error: '删除授权码失败' });
    }
});

/**
 * POST /auth-codes/cleanup - 清理旧版未使用的授权码 (管理员)
 */
router.post('/cleanup', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const oldTypes = ['registration', '10min', '60min'];

        // 删除旧版未使用的授权码
        const deletedCount = update(
            `DELETE FROM auth_codes WHERE code_type IN (${oldTypes.map(() => '?').join(',')}) AND is_used = 0`,
            oldTypes
        );

        console.log(`Cleaned up ${deletedCount} old unused auth codes`);

        res.json({
            message: `成功清理 ${deletedCount} 个旧版未使用授权码`,
            deletedCount,
            cleanedTypes: oldTypes
        });
    } catch (error) {
        console.error('Cleanup auth codes error:', error);
        res.status(500).json({ error: '清理授权码失败' });
    }
});

// 启动时自动清理旧版未使用的授权码（延迟执行等待数据库初始化）
setTimeout(() => {
    try {
        const oldTypes = ['registration', '10min', '60min'];
        const result = update(
            `DELETE FROM auth_codes WHERE code_type IN (${oldTypes.map(() => '?').join(',')}) AND is_used = 0`,
            oldTypes
        );
        if (result > 0) {
            console.log(`[Auth Codes] Startup cleanup: removed ${result} old unused auth codes`);
        }
    } catch (error) {
        console.error('[Auth Codes] Startup cleanup failed:', error);
    }
}, 5000);

export default router;
