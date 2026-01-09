import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, User } from '@/lib/api-client';
import { getDeviceFingerprint, getDeviceId } from '@/lib/device-fingerprint';

// 兼容旧 Profile 类型
export type Profile = {
  id: string;
  user_id: string;
  phone: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  voice_minutes: number;
  professional_voice_minutes: number;
  created_at: string;
  updated_at: string;
};

interface AuthContextType {
  user: User | null;
  session: { user: User } | null; // 兼容旧代码
  profile: Profile | null;
  loading: boolean;
  signIn: (account: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (account: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // 将 User 转换为 Profile 格式（兼容旧代码）
  const userToProfile = (u: User): Profile => ({
    id: u.id,
    user_id: u.id,
    phone: u.phone,
    display_name: u.displayName,
    avatar_url: u.avatarUrl,
    role: u.role,
    voice_minutes: u.voiceCredits,
    professional_voice_minutes: u.professionalVoiceMinutes,
    created_at: u.createdAt || '',
    updated_at: u.updatedAt || ''
  });

  const fetchProfile = async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);
      setProfile(userToProfile(userData));
      setIsAdmin(userData.role === 'admin');
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
    }
  };

  const refreshProfile = async () => {
    if (authApi.isLoggedIn()) {
      await fetchProfile();
    }
  };

  useEffect(() => {
    // 初始化时检查是否已登录
    const initAuth = async () => {
      if (authApi.isLoggedIn()) {
        try {
          await fetchProfile();
          // 检查设备
          try {
            await authApi.checkDevice(getDeviceId());
          } catch (e) {
            console.error('Device check error:', e);
          }
        } catch (error) {
          // Token 无效，清除
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const signIn = async (account: string, password: string) => {
    try {
      const data = await authApi.login(account, password, getDeviceId());
      setUser(data.user);
      setProfile(userToProfile(data.user));
      setIsAdmin(data.user.role === 'admin');
      return { error: null };
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || '登录失败';
      return { error: new Error(message) };
    }
  };

  const signUp = async (account: string, password: string) => {
    try {
      // 获取设备指纹用于防刷注册
      const fingerprint = getDeviceFingerprint();
      const data = await authApi.register(account, password, undefined, fingerprint);
      setUser(data.user);
      setProfile(userToProfile(data.user));
      setIsAdmin(data.user.role === 'admin');
      return { error: null };
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || '注册失败';
      return { error: new Error(message) };
    }
  };

  const signOut = async () => {
    try {
      await authApi.logout(getDeviceId());
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.removeItem('lastVideoId');
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session: user ? { user } : null,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      isAdmin,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
