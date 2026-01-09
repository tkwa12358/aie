import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Helmet } from 'react-helmet-async';

// 验证账号格式（手机号或邮箱）
const validateAccount = (account: string): { valid: boolean; type: 'phone' | 'email' | null; message: string } => {
  const phoneRegex = /^1[3-9]\d{9}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (phoneRegex.test(account)) {
    return { valid: true, type: 'phone', message: '' };
  }
  if (emailRegex.test(account)) {
    if (account.length > 50) {
      return { valid: false, type: null, message: '邮箱长度不能超过50个字符' };
    }
    return { valid: true, type: 'email', message: '' };
  }

  if (/^\d+$/.test(account)) {
    return { valid: false, type: null, message: '请输入正确的11位手机号' };
  }

  return { valid: false, type: null, message: '请输入有效的手机号或邮箱' };
};

// 防刷：注册频率限制
const REGISTER_COOLDOWN = 60000; // 60秒
const REGISTER_STORAGE_KEY = 'lastRegisterAttempt';

const Register = () => {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // 检查冷却时间
  useEffect(() => {
    const checkCooldown = () => {
      const lastAttempt = localStorage.getItem(REGISTER_STORAGE_KEY);
      if (lastAttempt) {
        const elapsed = Date.now() - parseInt(lastAttempt, 10);
        if (elapsed < REGISTER_COOLDOWN) {
          setCooldown(Math.ceil((REGISTER_COOLDOWN - elapsed) / 1000));
        }
      }
    };
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 防刷检查
    if (cooldown > 0) {
      toast({
        variant: 'destructive',
        title: '操作过于频繁',
        description: `请在 ${cooldown} 秒后重试`,
      });
      return;
    }

    // 验证账号格式
    const validation = validateAccount(account.trim());
    if (!validation.valid) {
      toast({
        variant: 'destructive',
        title: '账号格式错误',
        description: validation.message,
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: '密码不匹配',
        description: '请确保两次输入的密码一致',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: '密码太短',
        description: '密码至少需要6个字符',
      });
      return;
    }

    // 授权码改为可选（30天后才需要）

    setLoading(true);
    localStorage.setItem(REGISTER_STORAGE_KEY, Date.now().toString());

    const { error } = await signUp(account.trim(), password);

    if (error) {
      toast({
        variant: 'destructive',
        title: '注册失败',
        description: error.message,
      });
    } else {
      toast({
        title: '注册成功',
        description: '欢迎加入AI English Club！',
      });
      navigate('/learn');
    }

    setLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>注册 - AI English Club</title>
        <meta name="description" content="注册AI English Club账号，开始您的英语口语学习之旅" />
      </Helmet>
      
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md border-4 border-foreground bg-card p-8 shadow-lg">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary mx-auto mb-4 flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-2xl">AI</span>
            </div>
            <h1 className="text-3xl font-bold">加入我们</h1>
            <p className="text-muted-foreground mt-2">创建您的学习账号</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account">手机号 / 邮箱</Label>
              <Input
                id="account"
                type="text"
                inputMode="text"
                autoComplete="username"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="请输入手机号或邮箱"
                className="border-2 border-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请设置密码（至少6位）"
                className="border-2 border-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
                className="border-2 border-foreground"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full text-lg py-6 shadow-md hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
              disabled={loading || cooldown > 0}
            >
              {loading ? '注册中...' : cooldown > 0 ? `请等待 ${cooldown}s` : '注册'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              已有账号？
              <Link to="/login" className="text-foreground font-bold underline ml-1">
                立即登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
