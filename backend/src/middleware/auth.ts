import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractToken, JwtPayload } from '../utils/jwt';

// 扩展 Express Request 类型
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

/**
 * JWT 认证中间件
 * 验证请求头中的 Bearer token
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const token = extractToken(req.headers.authorization);

    if (!token) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: '未提供认证 Token'
        });
    }

    const payload = verifyToken(token);

    if (!payload) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Token 无效或已过期'
        });
    }

    req.user = payload;
    next();
}

/**
 * 可选认证中间件
 * 如果提供了 token，则验证并附加用户信息
 * 如果没有提供，也允许请求继续
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    const token = extractToken(req.headers.authorization);

    if (token) {
        const payload = verifyToken(token);
        if (payload) {
            req.user = payload;
        }
    }

    next();
}
