import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Helmet } from 'react-helmet-async';

const Login = () => {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    console.log('Attempting login with account:', account);
    const { error } = await signIn(account.trim(), password);

    if (error) {
      console.error('Login Error Object:', error);
      toast({
        variant: 'destructive',
        title: '登录失败',
        description: `${error.message || '请检查账号和密码'}`,
      });
    } else {
      toast({
        title: '登录成功',
        description: '欢迎回来！',
      });
      navigate('/learn');
    }

    setLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>登录 - AI English Club</title>
        <meta name="description" content="登录AI English Club，开始您的英语口语学习之旅" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md border-4 border-foreground bg-card p-8 shadow-lg">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary mx-auto mb-4 flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-2xl">AI</span>
            </div>
            <h1 className="text-3xl font-bold">Let's speak now!</h1>
            <p className="text-muted-foreground mt-2">专为油管英语口语设计的学习网站</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                placeholder="请输入密码"
                className="border-2 border-foreground"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full text-lg py-6 shadow-md hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
              disabled={loading}
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              还没有账号？
              <Link to="/register" className="text-foreground font-bold underline ml-1">
                立即注册
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
