import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Smartphone, MoreHorizontal, AlertCircle } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function InstallPrompt() {
  const { isIOS, isStandalone, isPromptVisible, setPromptVisible, handleInstall } = usePWAInstall();

  const handleClose = useCallback(() => {
    setPromptVisible(false);
  }, [setPromptVisible]);

  // 已安装或不可见时不显示
  if (isStandalone || !isPromptVisible) {
    return null;
  }

  return (
    <Dialog open={isPromptVisible} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            添加到主屏幕
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
          <div className="rounded-lg bg-muted p-4 text-sm space-y-3">
            <p className="font-medium">iPhone/iPad 安装步骤：</p>
            <ol className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">1</span>
                <span>
                  点击 Safari 浏览器右下角的{' '}
                  <MoreHorizontal className="h-4 w-4 inline-block align-text-bottom mx-0.5" />
                  <span className="font-medium text-foreground">（更多）</span>按钮
                  <br />
                  <span className="text-xs">（或点击底部中间的分享按钮）</span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">2</span>
                <span>
                  在弹出菜单中向上滑动，找到并点击{' '}
                  <span className="font-medium text-foreground">"添加到主屏幕"</span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">3</span>
                <span>
                  点击右上角{' '}
                  <span className="font-medium text-foreground">"添加"</span>
                  {' '}完成安装
                </span>
              </li>
            </ol>
            <div className="flex items-center gap-2 pt-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs">请确保使用 Safari 浏览器打开本页面</span>
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isIOS ? (
            <Button onClick={handleClose} className="w-full">
              我知道了
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} className="flex-1">
                以后再说
              </Button>
              <Button onClick={handleInstall} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                安装应用
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
