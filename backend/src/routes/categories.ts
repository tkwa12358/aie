import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, run, update } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';

const router = Router();

/**
 * GET /categories - 获取所有分类
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const categories = query(
            'SELECT * FROM video_categories ORDER BY sort_order ASC, created_at ASC'
        );
        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: '获取分类列表失败' });
    }
});

/**
 * GET /categories/:id - 获取分类详情
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const category = queryOne('SELECT * FROM video_categories WHERE id = ?', [id]);

        if (!category) {
            return res.status(404).json({ error: '分类不存在' });
        }
        res.json(category);
    } catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({ error: '获取分类详情失败' });
    }
});

/**
 * POST /categories - 创建分类 (管理员)
 */
router.post('/', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { name, description, sortOrder } = req.body;

        if (!name) {
            return res.status(400).json({ error: '请提供分类名称' });
        }

        const id = uuidv4();
        run(
            'INSERT INTO video_categories (id, name, description, sort_order) VALUES (?, ?, ?, ?)',
            [id, name, description || null, sortOrder || 0]
        );

        const category = queryOne('SELECT * FROM video_categories WHERE id = ?', [id]);
        res.status(201).json(category);
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ error: '创建分类失败' });
    }
});

/**
 * PUT /categories/:id - 更新分类 (管理员)
 */
router.put('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, sortOrder } = req.body;

        const updates: string[] = [];
        const params: any[] = [];

        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(sortOrder); }

        if (updates.length === 0) {
            return res.status(400).json({ error: '没有要更新的字段' });
        }

        params.push(id);
        const result = update(`UPDATE video_categories SET ${updates.join(', ')} WHERE id = ?`, params);

        if (result === 0) {
            return res.status(404).json({ error: '分类不存在' });
        }

        const category = queryOne('SELECT * FROM video_categories WHERE id = ?', [id]);
        res.json(category);
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: '更新分类失败' });
    }
});

/**
 * DELETE /categories/:id - 删除分类 (管理员)
 */
router.delete('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = update('DELETE FROM video_categories WHERE id = ?', [id]);

        if (result === 0) {
            return res.status(404).json({ error: '分类不存在' });
        }

        res.json({ message: '分类已删除' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: '删除分类失败' });
    }
});

export default router;
