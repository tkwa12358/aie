import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Clock, Key, Loader2, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authCodesApi } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

const Profile: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  // 获取专业评测时间（数据库直接存储秒数）
  const professionalSeconds = (profile as { professional_voice_minutes?: number })?.professional_voice_minutes || 0;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast({ title: '请输入授权码', variant: 'destructive' });
      return;
    }

    setIsRedeeming(true);
    try {
      const data = await authCodesApi.redeemCode(code.trim());

      toast({
        title: '兑换成功',
        description: data.message || '授权码兑换成功',
      });
      setCode('');
      await refreshProfile();
    } catch (error: any) {
      console.error('Redeem error:', error);
      const errorMessage = error.response?.data?.error || error.message || '请检查授权码是否正确';
      toast({
        title: '兑换失败',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>个人资料 - AI English Club</title>
        <meta name="description" content="查看个人资料和评测时间" />
      </Helmet>

      <div className="min-h-screen gradient-bg dark:gradient-bg-dark">
        <Header />

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">个人资料</h1>

            {/* 用户信息卡片 */}
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  账户信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground text-sm">昵称</Label>
                    <p className="font-medium">{profile?.display_name || '未设置'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">手机号</Label>
                    <p className="font-medium">{profile?.phone || user?.email || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 评测时间卡片 */}
            <Card className="glass border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  专业评测时间
                </CardTitle>
                <CardDescription>
                  使用微软/腾讯专业发音评测引擎
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Clock className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-primary">{professionalSeconds}</p>
                    <p className="text-sm text-muted-foreground">剩余评测秒数</p>
                  </div>
                </div>

                <div className="mt-4 text-sm text-muted-foreground">
                  <p>• 音素级精准评分</p>
                  <p>• 单词级发音纠错</p>
                  <p>• 专业发音指导建议</p>
                </div>
              </CardContent>
            </Card>

            {/* 授权码充值卡片 */}
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  授权码充值
                </CardTitle>
                <CardDescription>
                  输入授权码为评测时间充值
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRedeem} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">授权码</Label>
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="XXXX-XXXX-XXXX"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      授权码可在合作平台购买获取
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isRedeeming}>
                    {isRedeeming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    兑换授权码
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
};

export default Profile;