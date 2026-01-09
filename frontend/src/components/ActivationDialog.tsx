import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authCodesApi } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

interface ActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivated: () => void;
}

const WECHAT_ID = '384999233';

export const ActivationDialog: React.FC<ActivationDialogProps> = ({
  open,
  onOpenChange,
  onActivated,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(WECHAT_ID);
      setCopied(true);
      toast({ title: '已复制微信号' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: '复制失败', variant: 'destructive' });
    }
  };

  const handleActivate = async () => {
    if (!code.trim()) {
      toast({ title: '请输入授权码', variant: 'destructive' });
      return;
    }

    if (!user) {
      toast({ title: '请先登录', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      // 使用 API 兑换授权码
      // authCodesApi.redeemCode 会处理所有类型的授权码，包括注册/激活码
      const response = await authCodesApi.redeemCode(code.trim());

      // 如果兑换成功，后端会返回成功信息
      toast({
        title: '激活成功',
        description: response.message || '您的账号已激活，可以继续使用所有功能'
      });
      onActivated();
    } catch (error: any) {
      console.error('Activation error:', error);
      const errorMessage = error.response?.data?.error || error.message || '激活失败，请检查授权码';
      toast({
        title: '激活失败',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">试用期已结束</DialogTitle>
          <DialogDescription className="text-center">
            您的30天免费试用期已结束，请购买授权码继续使用全部功能
          </DialogDescription>
        </DialogHeader>

        {!showCodeInput ? (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <p className="text-muted-foreground mb-3">购买授权码请加微信：</p>
              <div className="flex items-center justify-center gap-2">
                <div className="px-4 py-2 bg-muted rounded-lg font-mono text-lg font-semibold">
                  {WECHAT_ID}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-center text-sm text-muted-foreground mb-3">已有授权码？</p>
              <Button
                className="w-full"
                onClick={() => setShowCodeInput(true)}
              >
                立即激活
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="activation-code">授权码</Label>
              <Input
                id="activation-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="请输入授权码"
                disabled={loading}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowCodeInput(false);
                  setCode('');
                }}
                disabled={loading}
              >
                返回
              </Button>
              <Button
                className="flex-1"
                onClick={handleActivate}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    验证中...
                  </>
                ) : (
                  '激活'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
