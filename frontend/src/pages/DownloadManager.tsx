import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Download, Trash2, HardDrive, Video, Calendar, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getAllDownloadedVideos,
  deleteDownloadedVideo,
  clearAllDownloads,
  type VideoMetadata,
} from '@/lib/videoDownloadManager';
import { formatBytes, getStorageInfo, type StorageInfo } from '@/lib/storageManager';
import { useToast } from '@/hooks/use-toast';

export default function DownloadManager() {
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [downloadedVideos, storage] = await Promise.all([
        getAllDownloadedVideos(),
        getStorageInfo(),
      ]);
      setVideos(downloadedVideos.sort((a, b) => b.downloadedAt - a.downloadedAt));
      setStorageInfo(storage);
    } catch (error) {
      console.error('Failed to load downloads:', error);
      toast({
        title: '加载失败',
        description: '无法加载已下载的视频列表',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (videoId: number) => {
    try {
      setDeleting(`video-${videoId}`);
      await deleteDownloadedVideo(videoId);
      await loadData();
      toast({
        title: '删除成功',
        description: '视频已从本地存储中删除',
      });
    } catch (error) {
      console.error('Failed to delete video:', error);
      toast({
        title: '删除失败',
        description: '无法删除该视频',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllDownloads();
      await loadData();
      toast({
        title: '清空成功',
        description: '所有已下载的视频已被清除',
      });
    } catch (error) {
      console.error('Failed to clear downloads:', error);
      toast({
        title: '清空失败',
        description: '无法清空下载内容',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalSize = videos.reduce((sum, v) => sum + v.size, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
          <h1 className="font-semibold">下载管理</h1>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* 存储信息 */}
        {storageInfo && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="h-4 w-4" />
                存储空间
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={storageInfo.usagePercent} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>已使用 {formatBytes(storageInfo.usage)}</span>
                <span>总共 {formatBytes(storageInfo.quota)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Download className="h-4 w-4 text-primary" />
                <span>已下载视频占用: {formatBytes(totalSize)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 视频列表 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Video className="h-4 w-4" />
                已下载视频
              </CardTitle>
              <CardDescription>
                {videos.length} 个视频
              </CardDescription>
            </div>
            {videos.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    全部清空
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认清空所有下载？</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作将删除所有已下载的视频和字幕。此操作无法撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      确认清空
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Download className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">暂无已下载的视频</p>
                <p className="text-sm text-muted-foreground mt-1">
                  在视频播放页面点击下载按钮即可离线保存
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {videos.map((video) => (
                  <div key={video.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                    {/* 缩略图 */}
                    <div className="w-24 h-16 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* 视频信息 */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{video.title}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{formatBytes(video.size)}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(video.downloadedAt)}
                        </span>
                      </div>
                    </div>

                    {/* 删除按钮 */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={deleting === video.id}
                        >
                          {deleting === video.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除？</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除 "{video.title}" 吗？此操作将同时删除视频和字幕缓存。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(video.videoId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            确认删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 提示信息 */}
        <Card className="bg-muted/50">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">关于离线视频</p>
              <ul className="list-disc list-inside space-y-1">
                <li>已下载的视频可在无网络时播放</li>
                <li>iOS 设备的存储空间约为 1GB</li>
                <li>建议在 WiFi 环境下下载视频</li>
                <li>清除浏览器数据可能会删除已下载的内容</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
