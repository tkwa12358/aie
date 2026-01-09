import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, run, update } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { hashPassword } from '../utils/crypto';

const router = Router();

interface User {
    id: string;
    email: string | null;
    phone: string | null;
    display_name: string | null;
    avatar_url: string | null;
    role: 'user' | 'admin';
    voice_credits: number;
    professional_voice_minutes: number;
    created_at: string;
    updated_at: string;
}

/**
 * GET /users - 获取用户列表 (管理员)
 */
router.get('/', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const users = query<User>(
            `SELECT id, email, phone, display_name, avatar_url, role, 
              voice_credits, professional_voice_minutes, created_at, updated_at
       FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const countResult = queryOne<{ total: number }>('SELECT COUNT(*) as total FROM users');
        const total = countResult?.total || 0;

        res.json({
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

/**
 * GET /users/:id - 获取用户详情
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user?.userId;
        const isAdmin = req.user?.role === 'admin';

        if (!isAdmin && id !== currentUserId) {
            return res.status(403).json({ error: '无权限查看该用户信息' });
        }

        const user = queryOne<User>(
            `SELECT id, email, phone, display_name, avatar_url, role, 
              voice_credits, professional_voice_minutes, created_at, updated_at
       FROM users WHERE id = ?`,
            [id]
        );

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: '获取用户信息失败' });
    }
});

/**
 * PUT /users/:id - 更新用户信息
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user?.userId;
        const isAdmin = req.user?.role === 'admin';

        if (!isAdmin && id !== currentUserId) {
            return res.status(403).json({ error: '无权限更新该用户信息' });
        }

        const { displayName, avatarUrl, role, voiceCredits, professionalVoiceMinutes } = req.body;

        const updates: string[] = [];
        const params: any[] = [];

        if (displayName !== undefined) { updates.push('display_name = ?'); params.push(displayName); }
        if (avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(avatarUrl); }
        if (isAdmin) {
            if (role !== undefined) { updates.push('role = ?'); params.push(role); }
            if (voiceCredits !== undefined) { updates.push('voice_credits = ?'); params.push(voiceCredits); }
            if (professionalVoiceMinutes !== undefined) { updates.push('professional_voice_minutes = ?'); params.push(professionalVoiceMinutes); }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: '没有要更新的字段' });
        }

        params.push(id);
        update(`UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`, params);

        const user = queryOne<User>(
            `SELECT id, email, phone, display_name, avatar_url, role, 
              voice_credits, professional_voice_minutes, created_at, updated_at
       FROM users WHERE id = ?`,
            [id]
        );

        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: '更新用户信息失败' });
    }
});

/**
 * DELETE /users/:id - 删除用户 (管理员)
 */
router.delete('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (id === req.user?.userId) {
            return res.status(400).json({ error: '不能删除自己的账号' });
        }

        const result = update('DELETE FROM users WHERE id = ?', [id]);

        if (result === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        res.json({ message: '用户已删除' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: '删除用户失败' });
    }
});

/**
 * POST /users/:id/reset-password - 重置用户密码 (管理员)
 */
router.post('/:id/reset-password', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: '新密码长度至少6位' });
        }

        const passwordHash = await hashPassword(newPassword);
        const result = update('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);

        if (result === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        res.json({ message: '密码已重置' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: '重置密码失败' });
    }
});

export default router;
