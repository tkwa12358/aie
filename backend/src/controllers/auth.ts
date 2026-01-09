import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '../config/database';
import { hashPassword, comparePassword } from '../utils/crypto';
import { generateToken, generateRefreshToken, verifyToken, JwtPayload } from '../utils/jwt';

export interface User {
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

export interface RegisterRequest {
  account: string;
  password: string;
  code?: string;
  deviceFingerprint?: string;
}

export interface LoginRequest {
  account: string;
  password: string;
  deviceId?: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface LogoutRequest {
  deviceId?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * 认证控制器
 * 处理用户注册、登录、登出和Token管理
 */
export class AuthController {
  /**
   * 用户注册
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { account, password, code: _code, deviceFingerprint }: RegisterRequest = req.body;

      // 输入验证
      if (!account || !password) {
        res.status(400).json({
          error: 'MISSING_FIELDS',
          message: '请提供账号和密码'
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          error: 'WEAK_PASSWORD',
          message: '密码长度至少6位'
        });
        return;
      }

      // 检查设备注册限制
      if (deviceFingerprint) {
        const deviceLimitCheck = await this.checkDeviceLimit(deviceFingerprint);
        if (!deviceLimitCheck.allowed) {
          res.status(403).json({
            error: 'DEVICE_LIMIT',
            message: '该设备已达注册上限，如需帮助请联系客服',
            code: 'DEVICE_LIMIT'
          });
          return;
        }
      }

      // 标准化账号格式
      const { email, phone } = this.normalizeAccount(account);

      // 检查用户是否已存在
      const existingUser = queryOne(
        'SELECT id FROM users WHERE email = ? OR phone = ?',
        [email, phone]
      );

      if (existingUser) {
        res.status(409).json({
          error: 'USER_EXISTS',
          message: '该账号已被注册'
        });
        return;
      }

      // 创建用户
      const userId = uuidv4();
      const passwordHash = await hashPassword(password);
      const displayName = phone || email.split('@')[0];

      // 开启事务创建用户和相关数据
      await this.createUserWithTransaction(
        userId,
        email,
        phone,
        passwordHash,
        displayName,
        deviceFingerprint,
        account
      );

      // 生成认证令牌
      const tokenPayload: JwtPayload = {
        userId,
        role: 'user'
      };

      if (email) {
        tokenPayload.email = email;
      }

      if (phone) {
        tokenPayload.phone = phone;
      }

      const token = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // 获取完整用户信息
      const user = await this.getUserById(userId);

      res.status(201).json({
        token,
        refreshToken,
        user: this.formatUserResponse(user!)
      });

    } catch (error) {
      console.error('注册错误:', error);
      res.status(500).json({
        error: 'REGISTRATION_FAILED',
        message: '注册失败，请稍后重试'
      });
    }
  }

  /**
   * 用户登录
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { account, password, deviceId, deviceInfo }: LoginRequest = req.body;

      // 输入验证
      if (!account || !password) {
        res.status(400).json({
          error: 'MISSING_FIELDS',
          message: '请提供账号和密码'
        });
        return;
      }

      // 标准化账号格式并查找用户
      const { email } = this.normalizeAccount(account);
      const user = queryOne(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (!user) {
        res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: '账号或密码错误'
        });
        return;
      }

      // 验证密码
      const isValidPassword = await comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: '账号或密码错误'
        });
        return;
      }

      // 生成认证令牌
      const tokenPayload: JwtPayload = {
        userId: user.id,
        email: user.email || undefined,
        phone: user.phone || undefined,
        role: user.role
      };

      const token = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // 记录会话信息
      if (deviceId) {
        await this.createSession(
          user.id,
          deviceId,
          token,
          deviceInfo,
          req.ip
        );
      }

      res.json({
        token,
        refreshToken,
        user: this.formatUserResponse(user)
      });

    } catch (error) {
      console.error('登录错误:', error);
      res.status(500).json({
        error: 'LOGIN_FAILED',
        message: '登录失败，请稍后重试'
      });
    }
  }

  /**
   * 用户登出
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId }: LogoutRequest = req.body;
      const userId = req.user?.userId;

      if (userId && deviceId) {
        run(
          'DELETE FROM user_sessions WHERE user_id = ? AND device_id = ?',
          [userId, deviceId]
        );
      }

      res.json({
        message: '登出成功'
      });

    } catch (error) {
      console.error('登出错误:', error);
      res.status(500).json({
        error: 'LOGOUT_FAILED',
        message: '登出失败'
      });
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: '未授权访问'
        });
        return;
      }

      const user = await this.getUserById(userId);

      if (!user) {
        res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: '用户不存在'
        });
        return;
      }

      res.json(this.formatUserResponse(user));

    } catch (error) {
      console.error('获取用户信息错误:', error);
      res.status(500).json({
        error: 'GET_USER_FAILED',
        message: '获取用户信息失败'
      });
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;

      if (!refreshToken) {
        res.status(400).json({
          error: 'MISSING_REFRESH_TOKEN',
          message: '请提供 refresh token'
        });
        return;
      }

      // 验证刷新令牌
      const payload = verifyToken(refreshToken);
      if (!payload) {
        res.status(401).json({
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token 无效或已过期'
        });
        return;
      }

      // 获取最新用户信息
      const user = queryOne(
        'SELECT id, email, phone, role FROM users WHERE id = ?',
        [payload.userId]
      );

      if (!user) {
        res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: '用户不存在'
        });
        return;
      }

      // 生成新的访问令牌
      const newPayload: JwtPayload = {
        userId: user.id,
        email: user.email || undefined,
        phone: user.phone || undefined,
        role: user.role
      };

      const newToken = generateToken(newPayload);
      const newRefreshToken = generateRefreshToken(newPayload);

      res.json({
        token: newToken,
        refreshToken: newRefreshToken
      });

    } catch (error) {
      console.error('刷新令牌错误:', error);
      res.status(500).json({
        error: 'REFRESH_FAILED',
        message: '刷新令牌失败'
      });
    }
  }

  /**
   * 检查设备注册限制
   */
  private async checkDeviceLimit(deviceFingerprint: string): Promise<{ allowed: boolean; limit: number }> {
    const regCount = queryOne(
      'SELECT COUNT(*) as count FROM device_registrations WHERE device_fingerprint = ?',
      [deviceFingerprint]
    );

    const maxReg = queryOne(
      'SELECT max_registrations FROM device_registrations WHERE device_fingerprint = ? LIMIT 1',
      [deviceFingerprint]
    );

    const limit = maxReg?.max_registrations || 3;
    const allowed = !regCount || regCount.count < limit;

    return { allowed, limit };
  }

  /**
   * 标准化账号格式
   */
  private normalizeAccount(account: string): { email: string; phone: string | null } {
    const isEmail = account.includes('@');
    const email = isEmail ? account : `${account}@aienglish.club`;
    const phone = isEmail ? null : account;

    return { email, phone };
  }

  /**
   * 事务性创建用户和相关数据
   */
  private async createUserWithTransaction(
    userId: string,
    email: string,
    phone: string | null,
    passwordHash: string,
    displayName: string,
    deviceFingerprint?: string,
    account?: string
  ): Promise<void> {
    // 创建用户
    run(
      `INSERT INTO users (id, email, phone, password_hash, display_name, role, email_confirmed_at)
       VALUES (?, ?, ?, ?, ?, 'user', datetime('now'))`,
      [userId, email, phone, passwordHash, displayName]
    );

    // 创建用户统计记录
    run(
      `INSERT INTO user_statistics (id, user_id) VALUES (?, ?)`,
      [uuidv4(), userId]
    );

    // 记录设备注册（如果提供了设备指纹）
    if (deviceFingerprint && account) {
      run(
        `INSERT INTO device_registrations (id, device_fingerprint, user_id, account)
         VALUES (?, ?, ?, ?)`,
        [uuidv4(), deviceFingerprint, userId, account]
      );
    }
  }

  /**
   * 创建用户会话
   */
  private async createSession(
    userId: string,
    deviceId: string,
    token: string,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<void> {
    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7天后过期

    // 删除该设备的旧会话
    run(
      'DELETE FROM user_sessions WHERE user_id = ? AND device_id = ?',
      [userId, deviceId]
    );

    // 插入新会话
    run(
      `INSERT INTO user_sessions (id, user_id, device_id, device_info, ip_address, token, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, userId, deviceId, deviceInfo, ipAddress, token, expiresAt.toISOString()]
    );
  }

  /**
   * 根据ID获取用户信息
   */
  private async getUserById(userId: string): Promise<User | null> {
    const result = queryOne(
      `SELECT id, email, phone, display_name, avatar_url, role,
              voice_credits, professional_voice_minutes, created_at, updated_at
       FROM users WHERE id = ?`,
      [userId]
    );
    return result || null;
  }

  /**
   * 格式化用户响应数据
   */
  private formatUserResponse(user: User): any {
    return {
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
    };
  }
}