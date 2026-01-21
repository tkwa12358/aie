import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, X, Smartphone, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALL_DISMISSED_KEY = 'pwa-install-dismissed';
const INSTALL_DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 天

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 检查是否是 iOS 设备
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    // 检查是否已安装为独立应用
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // 检查用户是否已拒绝安装
    const dismissedAt = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      if (Date.now() - dismissedTime < INSTALL_DISMISS_DURATION) {
        return;
      }
      localStorage.removeItem(INSTALL_DISMISSED_KEY);
    }

    // 监听安装提示事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS 设备显示手动安装提示
    if (ios && !standalone) {
      // 延迟显示，避免干扰用户首次体验
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setIsVisible(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now().toString());
    setIsVisible(false);
  }, []);

  // 已安装或不可见时不显示
  if (isStandalone || !isVisible) {
    return null;
  }

  return (
    <Dialog open={isVisible} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            安装 AI English Studio
          </DialogTitle>
          <DialogDescription>
            将应用添加到主屏幕，获得更好的使用体验
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Download className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">离线可用</p>
              <p className="text-sm text-muted-foreground">下载视频后可在无网络环境下学习</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Smartphone className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">原生体验</p>
              <p className="text-sm text-muted-foreground">全屏显示，像原生应用一样流畅</p>
            </div>
          </div>
        </div>

        {isIOS ? (
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-2">iOS 安装步骤：</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li className="flex items-center gap-2">
                点击底部的 <Share className="h-4 w-4 inline" /> 分享按钮
              </li>
              <li>向下滚动，点击"添加到主屏幕"</li>
              <li>点击右上角"添加"确认</li>
            </ol>
          </div>
        ) : null}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleDismiss} className="flex-1">
            <X className="h-4 w-4 mr-2" />
            以后再说
          </Button>
          {!isIOS && (
            <Button onClick={handleInstall} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              安装应用
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
