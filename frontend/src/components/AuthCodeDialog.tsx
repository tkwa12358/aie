import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Ticket, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authCodesApi } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface AuthCodeDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const AuthCodeDialog = ({ trigger, open, onOpenChange }: AuthCodeDialogProps) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const { user, refreshProfile, profile } = useAuth();
  const { toast } = useToast();

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen;

  const professionalSeconds = (profile as { professional_voice_minutes?: number })?.professional_voice_minutes || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      toast({
        variant: 'destructive',
        title: '请输入授权码',
      });
      return;
    }

    if (!user) {
      toast({
        variant: 'destructive',
        title: '请先登录',
      });
      return;
    }

    setLoading(true);

    try {
      // 使用后端 API 兑换授权码
      const result = await authCodesApi.redeemCode(code.trim());

      // 刷新用户信息
      await refreshProfile();

      if (result.codeType === 'registration') {
        toast({
          title: '激活成功',
          description: '您的账号已激活，可以继续使用所有功能',
        });
      } else {
        const minutesAdded = result.minutesAdded || 0;
        toast({
          title: '充值成功',
          description: `已添加 ${minutesAdded * 60} 秒专业评测时间`,
        });
      }

      setCode('');
      setIsOpen(false);
    } catch (err: any) {
      console.error('Auth code error:', err);
      const message = err.response?.data?.error || err.message || '请稍后重试';
      toast({
        variant: 'destructive',
        title: '操作失败',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="rounded-xl gap-2">
      <Ticket className="w-4 h-4" />
      <span className="hidden sm:inline">授权码</span>
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            使用授权码
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 当前时间显示 */}
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="text-sm">
              当前专业评测时间: <span className="font-bold text-primary">{professionalSeconds} 秒</span>
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="authCode">授权码</Label>
              <Input
                id="authCode"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="请输入授权码"
                autoComplete="off"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                输入授权码可充值专业语音评测时间
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                '确认使用'
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
