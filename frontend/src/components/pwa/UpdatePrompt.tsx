import { useEffect, useState, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RefreshCcw, X } from 'lucide-react';

export function UpdatePrompt() {
  const [isOpen, setIsOpen] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setIsOpen(true);
    }
  }, [needRefresh]);

  const handleUpdate = useCallback(() => {
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-primary" />
            发现新版本
          </DialogTitle>
          <DialogDescription>
            应用有新版本可用。刷新页面以获取最新功能和修复。
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              更新将刷新当前页面。请确保已保存所有未保存的数据。
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            <X className="h-4 w-4 mr-2" />
            稍后更新
          </Button>
          <Button onClick={handleUpdate} className="flex-1">
            <RefreshCcw className="h-4 w-4 mr-2" />
            立即更新
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
