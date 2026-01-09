import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * 日志级别枚举
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug'
}

/**
 * 日志接口
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId: string;
  method: string;
  url: string;
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
  ip: string;
  userId?: string;
  contentLength?: number;
  message?: string;
}

/**
 * 请求日志中间件
 * 记录所有HTTP请求的基本信息
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // 生成请求ID
  const requestId = generateRequestId();
  req.headers['x-request-id'] = requestId;

  // 记录请求开始
  const logEntry: Partial<LogEntry> = {
    timestamp: new Date().toISOString(),
    level: LogLevel.HTTP,
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: getClientIP(req)
  };

  const userAgent = req.get('User-Agent');
  if (userAgent) {
    logEntry.userAgent = userAgent;
  }

  if (req.user?.userId) {
    logEntry.userId = req.user.userId;
  }

  // 监听响应结束事件
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const contentLength = res.get('Content-Length');

    const completeLogEntry: LogEntry = {
      ...logEntry,
      statusCode: res.statusCode,
      responseTime,
      contentLength: contentLength ? parseInt(contentLength) : undefined,
      message: `${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime}ms`
    } as LogEntry;

    // 根据状态码确定日志级别
    if (res.statusCode >= 500) {
      completeLogEntry.level = LogLevel.ERROR;
    } else if (res.statusCode >= 400) {
      completeLogEntry.level = LogLevel.WARN;
    } else {
      completeLogEntry.level = LogLevel.INFO;
    }

    // 输出日志
    logRequest(completeLogEntry);
  });

  next();
}

/**
 * API访问日志中间件（更详细）
 * 仅用于重要的API端点
 */
export function apiLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || generateRequestId();

  // 记录详细的API调用信息
  const apiLogEntry = {
    timestamp: new Date().toISOString(),
    requestId,
    api: {
      method: req.method,
      endpoint: req.route?.path || req.path,
      originalUrl: req.originalUrl,
      params: req.params,
      query: sanitizeQuery(req.query),
      headers: sanitizeHeaders(req.headers),
      bodySize: req.get('Content-Length') || 0
    },
    client: {
      ip: getClientIP(req),
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer')
    },
    user: req.user ? {
      userId: req.user.userId,
      role: req.user.role,
      email: req.user.email
    } : null
  };

  console.log('📥 API请求:', JSON.stringify(apiLogEntry, null, 2));

  // 监听响应
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;

    const responseLogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      response: {
        statusCode: res.statusCode,
        responseTime,
        contentLength: res.get('Content-Length') || 0,
        contentType: res.get('Content-Type')
      },
      performance: {
        responseTime,
        slow: responseTime > 1000 // 标记慢请求
      }
    };

    if (responseTime > 1000) {
      console.warn('🐌 慢请求警告:', JSON.stringify(responseLogEntry, null, 2));
    } else {
      console.log('📤 API响应:', JSON.stringify(responseLogEntry, null, 2));
    }
  });

  next();
}

/**
 * 安全日志中间件
 * 记录安全相关事件
 */
export function securityLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();

  // 检查可疑活动
  const suspiciousPatterns = [
    /(?:union|select|insert|delete|update|drop|create|alter|exec|script)/i,
    /(?:javascript:|data:|vbscript:)/i,
    /<script[^>]*>.*?<\/script>/gi,
    /(?:\b(?:xp_|sp_|exec|shell|cmd|powershell))/i
  ];

  const checkSecurity = (value: any): string[] => {
    const issues: string[] = [];
    const str = JSON.stringify(value).toLowerCase();

    suspiciousPatterns.forEach((pattern, index) => {
      if (pattern.test(str)) {
        issues.push(`Pattern${index + 1}`);
      }
    });

    return issues;
  };

  // 检查请求中的安全问题
  const queryIssues = checkSecurity(req.query);
  const bodyIssues = checkSecurity(req.body);
  const securityIssues = [...queryIssues, ...bodyIssues];

  if (securityIssues.length > 0) {
    const securityLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      requestId,
      event: 'SECURITY_ALERT',
      issues: securityIssues,
      request: {
        method: req.method,
        url: req.originalUrl,
        ip: getClientIP(req),
        userAgent: req.get('User-Agent')
      },
      user: req.user ? {
        userId: req.user.userId,
        role: req.user.role
      } : null
    };

    console.warn('🚨 安全警告:', JSON.stringify(securityLogEntry, null, 2));
  }

  next();
}

/**
 * 性能监控中间件
 */
export function performanceLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();
  const startCPU = process.cpuUsage();
  const startMemory = process.memoryUsage();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endCPU = process.cpuUsage(startCPU);
    const endMemory = process.memoryUsage();

    const performanceData = {
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
      endpoint: req.path,
      method: req.method,
      performance: {
        responseTime: Number(endTime - startTime) / 1000000, // 转换为毫秒
        cpuUsage: {
          user: endCPU.user / 1000, // 转换为毫秒
          system: endCPU.system / 1000
        },
        memoryDelta: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          external: endMemory.external - startMemory.external
        },
        memoryUsage: {
          rss: Math.round(endMemory.rss / 1024 / 1024), // MB
          heapUsed: Math.round(endMemory.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(endMemory.heapTotal / 1024 / 1024), // MB
          external: Math.round(endMemory.external / 1024 / 1024) // MB
        }
      }
    };

    // 只记录慢请求或高内存使用的请求
    if (performanceData.performance.responseTime > 500 ||
        performanceData.performance.memoryUsage.heapUsed > 100) {
      console.warn('⚡ 性能监控:', JSON.stringify(performanceData, null, 2));
    }
  });

  next();
}

/**
 * 数据库操作日志
 */
export class DatabaseLogger {
  static logQuery(sql: string, params: any[], duration?: number): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'DATABASE_QUERY',
      sql: sql.replace(/\s+/g, ' ').trim(),
      params: this.sanitizeParams(params),
      duration: duration ? `${duration}ms` : undefined
    };

    if (duration && duration > 100) {
      console.warn('🐌 慢查询:', JSON.stringify(logEntry, null, 2));
    } else if (process.env.NODE_ENV === 'development') {
      console.log('💾 数据库:', JSON.stringify(logEntry, null, 2));
    }
  }

  static logError(error: Error, sql: string, params: any[]): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'DATABASE_ERROR',
      error: {
        name: error.name,
        message: error.message,
        code: (error as any).code
      },
      sql: sql.replace(/\s+/g, ' ').trim(),
      params: this.sanitizeParams(params)
    };

    console.error('💥 数据库错误:', JSON.stringify(logEntry, null, 2));
  }

  private static sanitizeParams(params: any[]): any[] {
    return params.map(param => {
      if (typeof param === 'string' && param.length > 50) {
        return param.substring(0, 50) + '...';
      }
      return param;
    });
  }
}

/**
 * 工具函数
 */

function generateRequestId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function getClientIP(req: Request): string {
  return req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    'unknown';
}

function sanitizeQuery(query: any): any {
  const sanitized = { ...query };
  const sensitiveFields = ['password', 'token', 'secret', 'key'];

  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  const sensitiveHeaders = [
    'authorization', 'cookie', 'x-api-key', 'x-auth-token'
  ];

  sensitiveHeaders.forEach(header => {
    if (header in sanitized) {
      sanitized[header] = '[REDACTED]';
    }
  });

  return {
    'content-type': sanitized['content-type'],
    'user-agent': sanitized['user-agent'],
    'accept': sanitized['accept'],
    'accept-language': sanitized['accept-language'],
    'x-forwarded-for': sanitized['x-forwarded-for'],
    'x-real-ip': sanitized['x-real-ip']
  };
}

function logRequest(entry: LogEntry): void {
  const color = getStatusColor(entry.statusCode || 0);
  const emoji = getStatusEmoji(entry.statusCode || 0);

  const message = `${emoji} ${entry.method} ${entry.url} ${entry.statusCode} ${entry.responseTime}ms`;

  switch (entry.level) {
    case LogLevel.ERROR:
      console.error(`${color}${message}\x1b[0m`);
      break;
    case LogLevel.WARN:
      console.warn(`${color}${message}\x1b[0m`);
      break;
    default:
      console.log(`${color}${message}\x1b[0m`);
  }

  // 开发环境下输出详细信息
  if (process.env.NODE_ENV === 'development' && entry.responseTime && entry.responseTime > 200) {
    console.log(`  📊 详情: IP=${entry.ip} User=${entry.userId || 'Anonymous'} Size=${entry.contentLength || 0}B`);
  }
}

function getStatusColor(statusCode: number): string {
  if (statusCode >= 500) return '\x1b[31m'; // 红色
  if (statusCode >= 400) return '\x1b[33m'; // 黄色
  if (statusCode >= 300) return '\x1b[36m'; // 青色
  if (statusCode >= 200) return '\x1b[32m'; // 绿色
  return '\x1b[37m'; // 白色
}

function getStatusEmoji(statusCode: number): string {
  if (statusCode >= 500) return '💥';
  if (statusCode >= 400) return '⚠️';
  if (statusCode >= 300) return '↩️';
  if (statusCode >= 200) return '✅';
  return '📡';
}