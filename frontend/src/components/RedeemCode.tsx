import React, { useState } from 'react';
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
import { Key, Loader2 } from 'lucide-react';
import { authCodesApi } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface RedeemCodeProps {
  trigger?: React.ReactNode;
}

const RedeemCode: React.FC<RedeemCodeProps> = ({ trigger }) => {
  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast({ title: '请输入授权码', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const data = await authCodesApi.redeemCode(code.trim());

      toast({
        title: '兑换成功',
        description: data.message || `已获得 ${data.minutesAdded || 0} 分钟评测时间`,
      });
      setCode('');
      setIsOpen(false);
      await refreshProfile();
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || '请检查授权码是否正确';
      toast({
        title: '兑换失败',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Key className="h-4 w-4 mr-2" />
            兑换授权码
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>兑换授权码</DialogTitle>
        </DialogHeader>
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
              输入授权码可获得语音评测时长
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            兑换
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RedeemCode;
