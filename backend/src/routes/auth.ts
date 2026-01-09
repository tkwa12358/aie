import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, run } from '../config/database';
import { hashPassword, comparePassword } from '../utils/crypto';
import { generateToken, generateRefreshToken, JwtPayload } from '../utils/jwt';
import { authMiddleware } from '../middleware/auth';

const router = Router();

interface User {
    id: string;
    email: string | null;
    phone: string | null;
    password_hash: string;
    display_name: string | null;
    avatar_url: string | null;
    role: 'user' | 'admin';
    voice_credits: number;
    professional_voice_minutes: number;
    email_confirmed_at: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * POST /auth/register - 用户注册
 */
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { account, password, code, deviceFingerprint } = req.body;

        if (!account || !password) {
            return res.status(400).json({ error: '请提供账号和密码' });
        }

        // 检查设备注册限制
        if (deviceFingerprint) {
            const regCount = queryOne<{ count: number }>(
                'SELECT COUNT(*) as count FROM device_registrations WHERE device_fingerprint = ?',
                [deviceFingerprint]
            );

            const maxReg = queryOne<{ max_registrations: number }>(
                'SELECT max_registrations FROM device_registrations WHERE device_fingerprint = ? LIMIT 1',
                [deviceFingerprint]
            );

            const limit = maxReg?.max_registrations || 3;

            if (regCount && regCount.count >= limit) {
                return res.status(403).json({
                    error: '该设备已达注册上限，如需帮助请联系客服',
                    code: 'DEVICE_LIMIT'
                });
            }
        }

        // 判断是邮箱还是手机号
        const isEmail = account.includes('@');
        const email = isEmail ? account : `${account}@aienglish.club`;
        const phone = isEmail ? null : account;

        // 检查用户是否已存在
        const existingUser = queryOne<User>(
            'SELECT id FROM users WHERE email = ? OR phone = ?',
            [email, phone]
        );

        if (existingUser) {
            return res.status(409).json({ error: '该账号已被注册' });
        }

        // 创建用户
        const userId = uuidv4();
        const passwordHash = await hashPassword(password);

        run(
            `INSERT INTO users (id, email, phone, password_hash, display_name, role, email_confirmed_at)
       VALUES (?, ?, ?, ?, ?, 'user', datetime('now'))`,
            [userId, email, phone, passwordHash, phone || email.split('@')[0]]
        );

        // 创建用户统计记录
        run(
            `INSERT INTO user_statistics (id, user_id) VALUES (?, ?)`,
            [uuidv4(), userId]
        );

        // 记录设备注册
        if (deviceFingerprint) {
            run(
                `INSERT INTO device_registrations (id, device_fingerprint, user_id, account)
                 VALUES (?, ?, ?, ?)`,
                [uuidv4(), deviceFingerprint, userId, account]
            );
        }

        // 生成 token
        const tokenPayload: JwtPayload = { userId, email, phone: phone || undefined, role: 'user' };
        const token = generateToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        // 获取用户信息
        const user = queryOne<User>(
            'SELECT id, email, phone, display_name, avatar_url, role, voice_credits, professional_voice_minutes, created_at FROM users WHERE id = ?',
            [userId]
        );

        res.status(201).json({
            token,
            refreshToken,
            user: {
                id: user?.id,
                email: user?.email,
                phone: user?.phone,
                displayName: user?.display_name,
                avatarUrl: user?.avatar_url,
                role: user?.role,
                voiceCredits: user?.voice_credits,
                professionalVoiceMinutes: user?.professional_voice_minutes
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: '注册失败，请稍后重试' });
    }
});

/**
 * POST /auth/login - 用户登录
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { account, password, deviceId } = req.body;

        if (!account || !password) {
            return res.status(400).json({ error: '请提供账号和密码' });
        }

        // 判断是邮箱还是手机号
        const isEmail = account.includes('@');
        const email = isEmail ? account : `${account}@aienglish.club`;

        // 查找用户
        const user = queryOne<User>(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (!user) {
            return res.status(401).json({ error: '账号或密码错误' });
        }

        // 验证密码
        const isValid = await comparePassword(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: '账号或密码错误' });
        }

        // 生成 token
        const tokenPayload: JwtPayload = {
            userId: user.id,
            email: user.email || undefined,
            phone: user.phone || undefined,
            role: user.role
        };
        const token = generateToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        // 记录会话 (如果提供了 deviceId)
        if (deviceId) {
            const sessionId = uuidv4();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            // 删除旧会话
            run('DELETE FROM user_sessions WHERE user_id = ? AND device_id = ?', [user.id, deviceId]);

            // 插入新会话
            run(
                `INSERT INTO user_sessions (id, user_id, device_id, token, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
                [sessionId, user.id, deviceId, token, expiresAt.toISOString()]
            );
        }

        res.json({
            token,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                displayName: user.display_name,
                avatarUrl: user.avatar_url,
                role: user.role,
                voiceCredits: user.voice_credits,
                professionalVoiceMinutes: user.professional_voice_minutes
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: '登录失败，请稍后重试' });
    }
});

/**
 * POST /auth/logout - 用户登出
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { deviceId } = req.body;
        const userId = req.user?.userId;

        if (userId && deviceId) {
            run(
                'DELETE FROM user_sessions WHERE user_id = ? AND device_id = ?',
                [userId, deviceId]
            );
        }

        res.json({ message: '登出成功' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: '登出失败' });
    }
});

/**
 * GET /auth/me - 获取当前用户信息
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;

        const user = queryOne<User>(
            `SELECT id, email, phone, display_name, avatar_url, role, 
              voice_credits, professional_voice_minutes, created_at, updated_at
       FROM users WHERE id = ?`,
            [userId]
        );

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        res.json({
            id: user.id,
            email: user.email,
            phone: user.phone,
            displayName: user.display_name,
            avatarUrl: user.avatar_url,
            role: user.role,
            voiceCredits: user.voice_credits,
            professionalVoiceMinutes: user.professional_voice_minutes,
            createdAt: user.created_at,
            updatedAt: user.updated_at
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: '获取用户信息失败' });
    }
});

/**
 * POST /auth/refresh - 刷新 Token
 */
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: '请提供 refresh token' });
        }

        const { verifyToken } = require('../utils/jwt');
        const payload = verifyToken(refreshToken);

        if (!payload) {
            return res.status(401).json({ error: 'Refresh token 无效或已过期' });
        }

        // 获取最新用户信息
        const user = queryOne<User>(
            'SELECT id, email, phone, role FROM users WHERE id = ?',
            [payload.userId]
        );

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        const newPayload: JwtPayload = {
            userId: user.id,
            email: user.email || undefined,
            phone: user.phone || undefined,
            role: user.role
        };

        const token = generateToken(newPayload);
        const newRefreshToken = generateRefreshToken(newPayload);

        res.json({ token, refreshToken: newRefreshToken });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: '刷新 token 失败' });
    }
});

/**
 * POST /auth/check-device - 检查设备限制
 */
router.post('/check-device', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { deviceId, maxDevices = 2 } = req.body;
        const userId = req.user?.userId;

        if (!deviceId) {
            return res.status(400).json({ error: '请提供设备ID' });
        }

        // 获取用户当前的设备会话数
        const sessions = query<any>(
            'SELECT id, device_id FROM user_sessions WHERE user_id = ? ORDER BY last_active_at DESC',
            [userId]
        );

        // 检查是否是已知设备
        const existingSession = sessions.find((s: any) => s.device_id === deviceId);

        if (existingSession) {
            run(
                "UPDATE user_sessions SET last_active_at = datetime('now') WHERE id = ?",
                [existingSession.id]
            );
            return res.json({ allowed: true, deviceCount: sessions.length });
        }

        // 检查是否超过设备限制
        if (sessions.length >= maxDevices) {
            const oldestSession = sessions[sessions.length - 1];
            run('DELETE FROM user_sessions WHERE id = ?', [oldestSession.id]);
        }

        // 创建新会话
        const sessionId = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        run(
            `INSERT INTO user_sessions (id, user_id, device_id, expires_at)
       VALUES (?, ?, ?, ?)`,
            [sessionId, userId, deviceId, expiresAt.toISOString()]
        );

        res.json({ allowed: true, deviceCount: Math.min(sessions.length + 1, maxDevices) });
    } catch (error) {
        console.error('Check device error:', error);
        res.status(500).json({ error: '设备检查失败' });
    }
});

/**
 * GET /auth/admin/devices - 获取设备注册列表（管理员）
 */
router.get('/admin/devices', authMiddleware, async (req: Request, res: Response) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: '需要管理员权限' });
        }

        const { search, limit = '50', offset = '0' } = req.query;

        let sql = `
            SELECT
                dr.id,
                dr.device_fingerprint,
                dr.user_id,
                dr.account,
                dr.max_registrations,
                dr.created_at,
                u.display_name,
                u.email
            FROM device_registrations dr
            LEFT JOIN users u ON dr.user_id = u.id
        `;
        const params: any[] = [];

        if (search) {
            sql += ` WHERE dr.account LIKE ? OR u.email LIKE ? OR u.display_name LIKE ?`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        sql += ` ORDER BY dr.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit as string), parseInt(offset as string));

        const devices = query(sql, params);

        // 获取每个设备指纹的注册统计
        const fingerprintStats: Record<string, { count: number; maxRegistrations: number }> = {};
        for (const device of devices as any[]) {
            if (!fingerprintStats[device.device_fingerprint]) {
                const countResult = queryOne<{ count: number }>(
                    'SELECT COUNT(*) as count FROM device_registrations WHERE device_fingerprint = ?',
                    [device.device_fingerprint]
                );
                fingerprintStats[device.device_fingerprint] = {
                    count: countResult?.count || 0,
                    maxRegistrations: device.max_registrations
                };
            }
        }

        // 合并统计信息
        const devicesWithStats = (devices as any[]).map(d => ({
            ...d,
            registrationCount: fingerprintStats[d.device_fingerprint]?.count || 0
        }));

        // 获取总数
        let countSql = 'SELECT COUNT(*) as total FROM device_registrations dr LEFT JOIN users u ON dr.user_id = u.id';
        const countParams: any[] = [];
        if (search) {
            countSql += ` WHERE dr.account LIKE ? OR u.email LIKE ? OR u.display_name LIKE ?`;
            const searchPattern = `%${search}%`;
            countParams.push(searchPattern, searchPattern, searchPattern);
        }
        const totalResult = queryOne<{ total: number }>(countSql, countParams);

        res.json({
            devices: devicesWithStats,
            total: totalResult?.total || 0
        });
    } catch (error) {
        console.error('Get devices error:', error);
        res.status(500).json({ error: '获取设备列表失败' });
    }
});

/**
 * POST /auth/admin/devices/unlock - 解锁设备（管理员）
 */
router.post('/admin/devices/unlock', authMiddleware, async (req: Request, res: Response) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: '需要管理员权限' });
        }

        const { deviceFingerprint, action, newLimit } = req.body;

        if (!deviceFingerprint) {
            return res.status(400).json({ error: '请提供设备指纹' });
        }

        if (action === 'delete') {
            // 删除该设备的所有注册记录
            run('DELETE FROM device_registrations WHERE device_fingerprint = ?', [deviceFingerprint]);
            return res.json({ message: '设备注册记录已清除' });
        } else if (action === 'increase-limit') {
            // 增加设备注册限制
            const limit = newLimit || 5;
            run(
                'UPDATE device_registrations SET max_registrations = ? WHERE device_fingerprint = ?',
                [limit, deviceFingerprint]
            );
            return res.json({ message: `设备注册上限已调整为 ${limit}` });
        } else {
            return res.status(400).json({ error: '无效的操作类型' });
        }
    } catch (error) {
        console.error('Unlock device error:', error);
        res.status(500).json({ error: '操作失败' });
    }
});

/**
 * DELETE /auth/admin/devices/:id - 删除单条设备注册记录（管理员）
 */
router.delete('/admin/devices/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: '需要管理员权限' });
        }

        const { id } = req.params;
        run('DELETE FROM device_registrations WHERE id = ?', [id]);
        res.json({ message: '记录已删除' });
    } catch (error) {
        console.error('Delete device registration error:', error);
        res.status(500).json({ error: '删除失败' });
    }
});

export default router;
