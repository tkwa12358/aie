import { Request, Response, NextFunction } from 'express';

/**
 * 管理员权限检查中间件
 * 必须在 authMiddleware 之后使用
 */
export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: '请先登录'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Forbidden',
            message: '需要管理员权限'
        });
    }

    next();
}
