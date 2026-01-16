import { Router, Request, Response } from 'express';
import { query, queryOne, run, update } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { v4 as uuidv4 } from 'uuid';
import { evaluatePronunciation, AssessmentProviderError, shouldFallback } from '../services/assessment';
import { appendErrorLog } from '../utils/error-log';

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

const recordProviderAlert = (provider: any, error: AssessmentProviderError) => {
    try {
        run(
            `INSERT INTO assessment_provider_alerts
       (id, provider_id, provider_name, provider_type, error_type, error_message, raw_response)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                uuidv4(),
                provider?.id || null,
                provider?.name || null,
                provider?.provider_type || null,
                error.type,
                error.message,
                error.details || null
            ]
        );
    } catch (err) {
        console.error('Record assessment alert failed:', err);
    }
};

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

        let providers = query(
            'SELECT * FROM professional_assessment_providers WHERE is_active = 1 ORDER BY is_default DESC, priority DESC, created_at DESC'
        );

        if (providerId) {
            const preferred = queryOne<any>('SELECT * FROM professional_assessment_providers WHERE id = ?', [providerId]);
            if (preferred) {
                providers = [preferred, ...providers.filter((item: any) => item.id !== preferred.id)];
            }
        }

        if (!providers.length) {
            return res.status(503).json({ error: '没有可用的评测服务', billed: false });
        }

        let result = null;
        let usedProvider: any = null;
        let lastError: AssessmentProviderError | null = null;

        for (const provider of providers) {
            try {
                result = await evaluatePronunciation(provider, {
                    text,
                    audioData,
                    language: 'en-US'
                });
                usedProvider = provider;
                break;
            } catch (error: any) {
                const normalizedError = error instanceof AssessmentProviderError
                    ? error
                    : new AssessmentProviderError('unknown', error?.message || '评测服务调用失败');
                recordProviderAlert(provider, normalizedError);
                void appendErrorLog({
                    timestamp: new Date().toISOString(),
                    type: 'ASSESSMENT_PROVIDER_ERROR',
                    providerId: provider?.id || null,
                    providerName: provider?.name || null,
                    providerType: provider?.provider_type || null,
                    errorType: normalizedError.type,
                    errorMessage: normalizedError.message,
                    errorDetails: normalizedError.details || null,
                    requestId: req.headers['x-request-id'],
                    userId
                });
                lastError = normalizedError;
                if (!shouldFallback(normalizedError)) {
                    return res.status(500).json({
                        error: normalizedError.message || '评测服务调用失败',
                        billed: false
                    });
                }
            }
        }

        if (!result || !usedProvider) {
            return res.status(503).json({
                error: '服务暂时不可用',
                billed: false
            });
        }

        const assessmentId = uuidv4();
        const durationSeconds = result.duration || 10;
        const secondsCharged = Math.max(1, Math.ceil(durationSeconds));
        const minutesCharged = Math.ceil(secondsCharged / 60);

        run(
            `INSERT INTO professional_assessments 
       (id, user_id, video_id, original_text, provider_id, provider_name, 
        pronunciation_score, accuracy_score, fluency_score, completeness_score, overall_score,
        words_result, feedback, duration_seconds, minutes_charged, is_billed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [assessmentId, userId, videoId || null, text, usedProvider.id, usedProvider.name,
                result.pronunciationScore, result.accuracyScore, result.fluencyScore, result.completenessScore, result.overallScore,
                JSON.stringify(result.words || []), result.feedback || null, durationSeconds, minutesCharged]
        );

        update('UPDATE users SET professional_voice_minutes = professional_voice_minutes - ? WHERE id = ?', [secondsCharged, userId]);
        update('UPDATE user_statistics SET total_assessments = total_assessments + 1 WHERE user_id = ?', [userId]);

        const remainingSeconds = Math.max(0, (user?.professional_voice_minutes || 0) - secondsCharged);

        res.json({
            assessmentId,
            overall_score: result.overallScore,
            pronunciation_score: result.pronunciationScore,
            accuracy_score: result.accuracyScore,
            fluency_score: result.fluencyScore,
            completeness_score: result.completenessScore,
            words_result: result.words || [],
            feedback: result.feedback,
            seconds_used: secondsCharged,
            remaining_seconds: remainingSeconds,
            billed: true,
            minutesCharged,
            provider: usedProvider.name
        });
    } catch (error) {
        console.error('Evaluate error:', error);
        void appendErrorLog({
            timestamp: new Date().toISOString(),
            type: 'ASSESSMENT_EVALUATE_ERROR',
            errorMessage: (error as Error)?.message || '评测服务错误',
            errorStack: (error as Error)?.stack,
            requestId: req.headers['x-request-id'],
            userId: req.user?.userId || null
        });
        res.status(500).json({ error: '评测服务错误', billed: false });
    }
});

/**
 * GET /assessment/alerts - 获取评测服务商告警日志 (管理员)
 */
router.get('/alerts', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { limit = '50', offset = '0' } = req.query;
        const alerts = query(
            `SELECT * FROM assessment_provider_alerts
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
            [parseInt(limit as string, 10), parseInt(offset as string, 10)]
        );
        res.json(alerts);
    } catch (error) {
        console.error('Get assessment alerts error:', error);
        res.status(500).json({ error: '获取告警日志失败' });
    }
});

/**
 * DELETE /assessment/alerts/:id - 删除评测服务商告警日志 (管理员)
 */
router.delete('/alerts/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        update('DELETE FROM assessment_provider_alerts WHERE id = ?', [id]);
        res.json({ message: '告警日志已删除' });
    } catch (error) {
        console.error('Delete assessment alert error:', error);
        res.status(500).json({ error: '删除告警日志失败' });
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
