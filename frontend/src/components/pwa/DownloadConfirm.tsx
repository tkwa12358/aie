import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Download, HardDrive, AlertCircle, Check } from 'lucide-react';
import { formatBytes, getStorageInfo, hasEnoughSpace, type StorageInfo } from '@/lib/storageManager';
import { downloadVideo, type DownloadProgress } from '@/lib/videoDownloadManager';

interface DownloadConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: number;
  title: string;
  videoUrl: string;
  subtitleUrls: string[];
  thumbnailUrl?: string;
  estimatedSize?: number;
  onDownloadComplete?: () => void;
}

type DownloadState = 'confirm' | 'downloading' | 'success' | 'error';

export function DownloadConfirm({
  isOpen,
  onClose,
  videoId,
  title,
  videoUrl,
  subtitleUrls,
  thumbnailUrl,
  estimatedSize = 50 * 1024 * 1024, // 默认预估 50MB
  onDownloadComplete,
}: DownloadConfirmProps) {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [hasSpace, setHasSpace] = useState(true);
  const [downloadState, setDownloadState] = useState<DownloadState>('confirm');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDownloadState('confirm');
      setProgress(null);
      setError(null);

      // 获取存储信息
      getStorageInfo().then(setStorageInfo);
      hasEnoughSpace(estimatedSize).then(setHasSpace);
    }
  }, [isOpen, estimatedSize]);

  const handleDownload = async () => {
    setDownloadState('downloading');
    setError(null);

    try {
      await downloadVideo(
        videoId,
        title,
        videoUrl,
        subtitleUrls,
        thumbnailUrl,
        (prog) => setProgress(prog)
      );
      setDownloadState('success');
      onDownloadComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载失败');
      setDownloadState('error');
    }
  };

  const handleClose = () => {
    if (downloadState !== 'downloading') {
      onClose();
    }
  };

  const renderContent = () => {
    switch (downloadState) {
      case 'confirm':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                下载视频
              </DialogTitle>
              <DialogDescription>
                下载后可在离线状态下观看此视频
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">视频标题</span>
                  <span className="font-medium truncate max-w-[200px]">{title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">预估大小</span>
                  <span className="font-medium">{formatBytes(estimatedSize)}</span>
                </div>
              </div>

              {storageInfo && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <HardDrive className="h-4 w-4" />
                      存储空间
                    </span>
                    <span>
                      {formatBytes(storageInfo.usage)} / {formatBytes(storageInfo.quota)}
                    </span>
                  </div>
                  <Progress value={storageInfo.usagePercent} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>已使用 {storageInfo.usagePercent.toFixed(1)}%</span>
                    <span>可用 {formatBytes(storageInfo.available)}</span>
                  </div>
                </div>
              )}

              {!hasSpace && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>存储空间不足，请先清理部分已下载的视频</span>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                取消
              </Button>
              <Button onClick={handleDownload} disabled={!hasSpace} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                开始下载
              </Button>
            </DialogFooter>
          </>
        );

      case 'downloading':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary animate-pulse" />
                正在下载...
              </DialogTitle>
              <DialogDescription>
                请勿关闭页面，下载完成后可离线观看
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-4">
              <div className="text-center text-sm text-muted-foreground">
                {title}
              </div>
              <Progress value={progress?.percent || 0} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{progress ? formatBytes(progress.loaded) : '0 B'}</span>
                <span>{progress?.percent || 0}%</span>
                <span>{progress ? formatBytes(progress.total) : formatBytes(estimatedSize)}</span>
              </div>
            </div>
          </>
        );

      case 'success':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                下载完成
              </DialogTitle>
              <DialogDescription>
                视频已保存，可在离线状态下观看
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">
                {title} 已成功下载
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                完成
              </Button>
            </DialogFooter>
          </>
        );

      case 'error':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                下载失败
              </DialogTitle>
              <DialogDescription>
                视频下载过程中发生错误
              </DialogDescription>
            </DialogHeader>

            <div className="py-6">
              <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                {error || '未知错误'}
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                关闭
              </Button>
              <Button onClick={handleDownload} className="flex-1">
                重试
              </Button>
            </DialogFooter>
          </>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
