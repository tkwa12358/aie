import { Request, Response, NextFunction } from 'express';

/**
 * 自定义错误类
 */
export class AppError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'AppError';
    }
}

/**
 * 全局错误处理中间件
 */
export function errorHandler(
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
) {
    console.error('Error:', err);

    // 如果是自定义的 AppError
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: err.name,
            message: err.message
        });
    }

    // MySQL 错误处理
    if ((err as any).code) {
        const mysqlError = err as any;
        switch (mysqlError.code) {
            case 'ER_DUP_ENTRY':
                return res.status(409).json({
                    error: 'Conflict',
                    message: '数据已存在'
                });
            case 'ER_NO_REFERENCED_ROW_2':
                return res.status(400).json({
                    error: 'Bad Request',
                    message: '关联数据不存在'
                });
            default:
                console.error('MySQL Error:', mysqlError.code, mysqlError.message);
        }
    }

    // 其他未知错误
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误'
    });
}

/**
 * 404 处理中间件
 */
export function notFoundHandler(req: Request, res: Response) {
    res.status(404).json({
        error: 'Not Found',
        message: `路径 ${req.method} ${req.path} 不存在`
    });
}
