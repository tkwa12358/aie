import { Router, Request, Response } from 'express';
import { query, queryOne, run, update } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * GET /assessment/providers - 获取评测供应商列表
 */
router.get('/providers', authMiddleware, async (req: Request, res: Response) => {
    try {
        const isAdmin = req.user?.role === 'admin';

        let sql = 'SELECT id, name, provider_type, region, is_active, is_default, priority FROM professional_assessment_providers';
        if (!isAdmin) { sql += ' WHERE is_active = 1'; }
        sql += ' ORDER BY priority DESC, is_default DESC';

        const providers = query(sql);
        res.json(providers);
    } catch (error) {
        console.error('Get assessment providers error:', error);
        res.status(500).json({ error: '获取评测供应商列表失败' });
    }
});

/**
 * POST /assessment/providers - 创建评测供应商 (管理员)
 */
router.post('/providers', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { name, providerType, apiEndpoint, apiKeySecretName, apiSecretKeyName, region, isDefault, priority, configJson } = req.body;

        if (!name || !providerType || !apiEndpoint) {
            return res.status(400).json({ error: '请提供必要的参数' });
        }

        const id = uuidv4();
        if (isDefault) { update('UPDATE professional_assessment_providers SET is_default = 0', []); }

        run(
            `INSERT INTO professional_assessment_providers 
       (id, name, provider_type, api_endpoint, api_key_secret_name, api_secret_key_name, region, is_default, priority, config_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, name, providerType, apiEndpoint, apiKeySecretName || null, apiSecretKeyName || null, region || null, isDefault ? 1 : 0, priority || 0, JSON.stringify(configJson || {})]
        );

        const provider = queryOne('SELECT * FROM professional_assessment_providers WHERE id = ?', [id]);
        res.status(201).json(provider);
    } catch (error) {
        console.error('Create assessment provider error:', error);
        res.status(500).json({ error: '创建评测供应商失败' });
    }
});

/**
 * PUT /assessment/providers/:id - 更新评测供应商 (管理员)
 */
router.put('/providers/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, providerType, apiEndpoint, apiKeySecretName, apiSecretKeyName, region, isActive, isDefault, priority, configJson } = req.body;

        const updates: string[] = [];
        const params: any[] = [];

        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (providerType !== undefined) { updates.push('provider_type = ?'); params.push(providerType); }
        if (apiEndpoint !== undefined) { updates.push('api_endpoint = ?'); params.push(apiEndpoint); }
        if (apiKeySecretName !== undefined) { updates.push('api_key_secret_name = ?'); params.push(apiKeySecretName); }
        if (apiSecretKeyName !== undefined) { updates.push('api_secret_key_name = ?'); params.push(apiSecretKeyName); }
        if (region !== undefined) { updates.push('region = ?'); params.push(region); }
        if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }
        if (isDefault !== undefined) {
            if (isDefault) { update('UPDATE professional_assessment_providers SET is_default = 0', []); }
            updates.push('is_default = ?'); params.push(isDefault ? 1 : 0);
        }
        if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
        if (configJson !== undefined) { updates.push('config_json = ?'); params.push(JSON.stringify(configJson)); }

        if (updates.length === 0) { return res.status(400).json({ error: '没有要更新的字段' }); }

        params.push(id);
        update(`UPDATE professional_assessment_providers SET ${updates.join(', ')} WHERE id = ?`, params);

        const provider = queryOne('SELECT * FROM professional_assessment_providers WHERE id = ?', [id]);
        res.json(provider);
    } catch (error) {
        console.error('Update assessment provider error:', error);
        res.status(500).json({ error: '更新评测供应商失败' });
    }
});

/**
 * DELETE /assessment/providers/:id - 删除评测供应商 (管理员)
 */
router.delete('/providers/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        update('DELETE FROM professional_assessment_providers WHERE id = ?', [id]);
        res.json({ message: '评测供应商已删除' });
    } catch (error) {
        console.error('Delete assessment provider error:', error);
        res.status(500).json({ error: '删除评测供应商失败' });
    }
});

/**
 * PUT /assessment/providers/:id/default - 设置默认评测供应商 (管理员)
 */
router.put('/providers/:id/default', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // 先取消所有默认
        update('UPDATE professional_assessment_providers SET is_default = 0', []);
        // 设置新默认
        update('UPDATE professional_assessment_providers SET is_default = 1 WHERE id = ?', [id]);

        res.json({ message: '已设为默认' });
    } catch (error) {
        console.error('Set default assessment provider error:', error);
        res.status(500).json({ error: '设置默认供应商失败' });
    }
});

/**
 * POST /assessment/evaluate - 发音评测
 */
router.post('/evaluate', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { text, audioData, videoId, providerId } = req.body;

        if (!text || !audioData) {
            return res.status(400).json({ error: '请提供文本和音频数据' });
        }

        const user = queryOne<any>('SELECT professional_voice_minutes FROM users WHERE id = ?', [userId]);
        if (!user || user.professional_voice_minutes <= 0) {
            return res.status(402).json({ error: '专业评测额度不足，请兑换授权码' });
        }

        let sql = 'SELECT * FROM professional_assessment_providers WHERE is_active = 1';
        if (providerId) { sql += ` AND id = '${providerId}'`; }
        sql += ' ORDER BY is_default DESC, priority DESC LIMIT 1';

        const provider = queryOne<any>(sql);

        if (!provider) {
            return res.status(503).json({ error: '没有可用的评测服务' });
        }

        // 模拟评测结果 (实际需要调用服务商 API)
        const result = {
            pronunciationScore: 85, accuracyScore: 88, fluencyScore: 82, completenessScore: 90, overallScore: 86,
            words: [], feedback: '发音良好', duration: 5
        };

        const assessmentId = uuidv4();
        const durationSeconds = result.duration || 10;
        const minutesCharged = Math.ceil(durationSeconds / 60);

        run(
            `INSERT INTO professional_assessments 
       (id, user_id, video_id, original_text, provider_id, provider_name, 
        pronunciation_score, accuracy_score, fluency_score, completeness_score, overall_score,
        words_result, feedback, duration_seconds, minutes_charged, is_billed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [assessmentId, userId, videoId || null, text, provider.id, provider.name,
                result.pronunciationScore, result.accuracyScore, result.fluencyScore, result.completenessScore, result.overallScore,
                JSON.stringify(result.words || []), result.feedback || null, durationSeconds, minutesCharged]
        );

        update('UPDATE users SET professional_voice_minutes = professional_voice_minutes - ? WHERE id = ?', [minutesCharged, userId]);
        update('UPDATE user_statistics SET total_assessments = total_assessments + 1 WHERE user_id = ?', [userId]);

        res.json({
            assessmentId,
            pronunciationScore: result.pronunciationScore,
            accuracyScore: result.accuracyScore,
            fluencyScore: result.fluencyScore,
            completenessScore: result.completenessScore,
            overallScore: result.overallScore,
            words: result.words,
            feedback: result.feedback,
            minutesCharged,
            provider: provider.name
        });
    } catch (error) {
        console.error('Evaluate error:', error);
        res.status(500).json({ error: '评测服务错误' });
    }
});

/**
 * GET /assessment/history - 获取评测历史
 */
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { limit = '10', offset = '0' } = req.query;

        const assessments = query(
            `SELECT pa.*, v.title as video_title
       FROM professional_assessments pa
       LEFT JOIN videos v ON pa.video_id = v.id
       WHERE pa.user_id = ?
       ORDER BY pa.created_at DESC
       LIMIT ? OFFSET ?`,
            [userId, parseInt(limit as string), parseInt(offset as string)]
        );

        res.json(assessments);
    } catch (error) {
        console.error('Get assessment history error:', error);
        res.status(500).json({ error: '获取评测历史失败' });
    }
});

export default router;
