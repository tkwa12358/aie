import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
// 默认7天过期 (秒数)
const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN_SECONDS || '604800');

export interface JwtPayload {
    userId: string;
    email?: string;
    phone?: string;
    role: 'user' | 'admin';
}

/**
 * 生成 JWT Token
 */
export function generateToken(payload: JwtPayload): string {
    // 清理未定义的可选属性
    const cleanPayload: JwtPayload = {
        userId: payload.userId,
        role: payload.role
    };

    if (payload.email) {
        cleanPayload.email = payload.email;
    }

    if (payload.phone) {
        cleanPayload.phone = payload.phone;
    }

    return jwt.sign(cleanPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'ai-english-studio'
    });
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string): JwtPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (error) {
        return null;
    }
}

/**
 * 从 Authorization header 提取 token
 */
export function extractToken(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}

/**
 * 生成刷新 Token (有效期更长 - 30天)
 */
export function generateRefreshToken(payload: JwtPayload): string {
    // 清理未定义的可选属性
    const cleanPayload: JwtPayload = {
        userId: payload.userId,
        role: payload.role
    };

    if (payload.email) {
        cleanPayload.email = payload.email;
    }

    if (payload.phone) {
        cleanPayload.phone = payload.phone;
    }

    return jwt.sign(cleanPayload, JWT_SECRET, {
        expiresIn: 2592000, // 30 days in seconds
        issuer: 'ai-english-studio'
    });
}
