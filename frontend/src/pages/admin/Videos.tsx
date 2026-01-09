import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Loader2, CheckCircle2, ImagePlus, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { videosApi, categoriesApi, Video, VideoCategory } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/admin/AdminLayout';

const generateThumbnail = (videoFile: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      // Capture at 0.5s to get a meaningful frame
      video.currentTime = 0.5;
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Thumbnail generation failed'));
          }
          // Clean up
          video.remove();
        }, 'image/jpeg', 0.8);
      } catch (e) {
        reject(e);
      }
    };
    video.onerror = (e) => reject(new Error('Video load error'));
    video.src = URL.createObjectURL(videoFile);
  });
};

// 从视频URL生成缩略图
const generateThumbnailFromUrl = (videoUrl: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      video.currentTime = 0.5; // 取0.5秒处的帧
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('缩略图生成失败'));
          }
          video.remove();
        }, 'image/jpeg', 0.8);
      } catch (e) {
        reject(e);
      }
    };
    video.onerror = () => reject(new Error('视频加载失败'));
    video.src = videoUrl;
  });
};

// SRT Parser Helper
const parseBilingualSRT = (srtContent: string) => {
  const lines = srtContent.trim().split(/\r?\n/);
  let enSRT = '';
  let cnSRT = '';

  let i = 0;
  let counter = 1;

  while (i < lines.length) {
    const indexLine = lines[i].trim();
    if (!indexLine) {
      i++;
      continue;
    }

    // Expecting index number
    if (!/^\d+$/.test(indexLine)) {
      i++; continue;
    }

    // Time line
    const timeLine = lines[i + 1]?.trim();

    // Content lines
    let enLine = '';
    let cnLine = '';

    let j = i + 2;
    while (j < lines.length && lines[j].trim() !== '') {
      const line = lines[j].trim();
      // Assuming first line is English, second is Chinese, or mixed logic
      // Simple heuristic: if contains Chinese characters -> Chinese, else English
      if (/[\u4e00-\u9fa5]/.test(line)) {
        cnLine += (cnLine ? '\n' : '') + line;
      } else {
        enLine += (enLine ? '\n' : '') + line;
      }
      j++;
    }

    // Re-scanning content lines for a more robust bilingual split
    const contentLines = [];
    j = i + 2;
    while (j < lines.length && lines[j].trim() !== '') {
      contentLines.push(lines[j].trim());
      j++;
    }

    if (contentLines.length > 0) {
      if (contentLines.length === 1) {
        // Check if mixed
        if (/[\u4e00-\u9fa5]/.test(contentLines[0])) {
          cnLine = contentLines[0]; // All Chinese?
        } else {
          enLine = contentLines[0];
        }
      } else {
        // Usually line 1 en, line 2 cn
        enLine = contentLines[0];
        cnLine = contentLines.slice(1).join('\n');
      }
    }

    if (enLine) {
      enSRT += `${counter}\n${timeLine}\n${enLine}\n\n`;
    }
    if (cnLine) {
      cnSRT += `${counter}\n${timeLine}\n${cnLine}\n\n`;
    }

    if (enLine || cnLine) counter++;
    i = j;
  }

  return { en: enSRT.trim(), cn: cnSRT.trim() };
};

const AdminVideos: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    video_url: '',
    thumbnail_url: '',
    category_id: '',
    subtitles_en: '',
    subtitles_cn: '',
    is_published: false,
  });

  const { data: videos = [] } = useQuery({
    queryKey: ['admin-videos'],
    queryFn: async () => {
      const data = await videosApi.getVideos();
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const data = await categoriesApi.getCategories();
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await videosApi.createVideo({
        title: data.title,
        description: data.description,
        videoUrl: data.video_url,
        thumbnailUrl: data.thumbnail_url,
        categoryId: data.category_id || null,
        subtitlesEn: data.subtitles_en,
        subtitlesCn: data.subtitles_cn,
        isPublished: data.is_published,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
      toast({ title: '视频创建成功' });
      setIsOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: '创建失败', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      await videosApi.updateVideo(id, {
        title: data.title,
        description: data.description,
        videoUrl: data.video_url,
        thumbnailUrl: data.thumbnail_url,
        categoryId: data.category_id || null,
        subtitlesEn: data.subtitles_en,
        subtitlesCn: data.subtitles_cn,
        isPublished: data.is_published,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
      toast({ title: '视频更新成功' });
      setIsOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: '更新失败', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await videosApi.deleteVideo(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
      toast({ title: '视频删除成功' });
    },
    onError: (error: any) => {
      toast({ title: '删除失败', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      video_url: '',
      thumbnail_url: '',
      category_id: '',
      subtitles_en: '',
      subtitles_cn: '',
      is_published: false,
    });
    setEditingVideo(null);
  };

  const handleEdit = (video: Video) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      description: video.description || '',
      video_url: video.video_url,
      thumbnail_url: video.thumbnail_url || '',
      category_id: video.category_id || '',
      subtitles_en: video.subtitles_en || '',
      subtitles_cn: video.subtitles_cn || '',
      is_published: video.is_published,
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVideo) {
      updateMutation.mutate({ id: editingVideo.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>视频管理 - 管理后台</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">视频管理</h1>
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                添加视频
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingVideo ? '编辑视频' : '添加视频'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">标题</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">分类</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择分类" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-4 border p-4 rounded-lg bg-muted/50">
                  <h3 className="font-medium">上传文件</h3>

                  {/* Video Upload Logic with Auto Thumbnail */}
                  <div className="space-y-2">
                    <Label className="font-semibold text-primary">1. 上传本地视频</Label>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="video/*"
                          disabled={uploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            setUploading(true);
                            try {
                              // 1. Upload Video using API
                              const videoResult = await videosApi.uploadVideo(file);
                              const videoUrl = videoResult.videoUrl;

                              // 2. Generate and Upload Thumbnail
                              toast({ title: '视频上传成功', description: '正在生成封面图...' });

                              let thumbnailUrl = '';
                              try {
                                const thumbBlob = await generateThumbnail(file);
                                const thumbFile = new File([thumbBlob], `thumb-${Date.now()}.jpg`, { type: 'image/jpeg' });

                                const thumbResult = await videosApi.uploadThumbnail(thumbFile);
                                thumbnailUrl = thumbResult.thumbnailUrl;
                              } catch (thumbErr) {
                                console.error('Thumbnail generation failed', thumbErr);
                                toast({ title: '封面生成失败', description: '请稍后重试或忽略', variant: 'destructive' });
                              }

                              setFormData(prev => ({
                                ...prev,
                                video_url: videoUrl,
                                thumbnail_url: thumbnailUrl,
                                title: file.name.replace(/\.[^/.]+$/, "") // Auto-fill title
                              }));

                              toast({ title: '处理完成', description: '视频和封面已更新' });
                            } catch (error: any) {
                              toast({ title: '上传失败', description: error.message, variant: 'destructive' });
                            } finally {
                              setUploading(false);
                            }
                          }}
                        />
                        {uploading && <Loader2 className="animate-spin w-4 h-4" />}
                      </div>
                      {/* Video and Thumbnail Status/Preview */}
                      {formData.video_url && (
                        <p className="text-xs text-muted-foreground break-all">
                          视频链接: {formData.video_url}
                        </p>
                      )}

                      {/* 缩略图管理区域 */}
                      <div className="mt-3 p-3 border rounded-lg bg-muted/30">
                        <Label className="text-sm font-medium mb-2 block">视频封面</Label>

                        {formData.thumbnail_url ? (
                          <div className="flex gap-3 items-start">
                            <img src={formData.thumbnail_url} className="h-20 w-32 object-cover rounded border" alt="Thumbnail" />
                            <div className="flex flex-col gap-2">
                              <p className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                封面已设置
                              </p>
                              <div className="flex gap-2">
                                {/* 重新生成按钮 */}
                                {formData.video_url && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={uploadingThumbnail}
                                    onClick={async () => {
                                      setUploadingThumbnail(true);
                                      try {
                                        const thumbBlob = await generateThumbnailFromUrl(formData.video_url);
                                        const thumbFile = new File([thumbBlob], `thumb-${Date.now()}.jpg`, { type: 'image/jpeg' });

                                        const thumbResult = await videosApi.uploadThumbnail(thumbFile);

                                        setFormData(prev => ({ ...prev, thumbnail_url: thumbResult.thumbnailUrl }));
                                        toast({ title: '封面已重新生成' });
                                      } catch (err: any) {
                                        toast({ title: '生成失败', description: err.message, variant: 'destructive' });
                                      } finally {
                                        setUploadingThumbnail(false);
                                      }
                                    }}
                                  >
                                    {uploadingThumbnail ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                    <span className="ml-1">重新生成</span>
                                  </Button>
                                )}
                                {/* 手动上传按钮 */}
                                <label>
                                  <Button type="button" variant="outline" size="sm" disabled={uploadingThumbnail} asChild>
                                    <span>
                                      <ImagePlus className="w-3 h-3 mr-1" />
                                      上传图片
                                    </span>
                                  </Button>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      setUploadingThumbnail(true);
                                      try {
                                        const thumbResult = await videosApi.uploadThumbnail(file);
                                        setFormData(prev => ({ ...prev, thumbnail_url: thumbResult.thumbnailUrl }));
                                        toast({ title: '封面已上传' });
                                      } catch (err: any) {
                                        toast({ title: '上传失败', description: err.message, variant: 'destructive' });
                                      } finally {
                                        setUploadingThumbnail(false);
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <p className="text-xs text-muted-foreground">暂无封面</p>
                            <div className="flex gap-2">
                              {/* 从视频生成按钮 */}
                              {formData.video_url && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={uploadingThumbnail}
                                  onClick={async () => {
                                    setUploadingThumbnail(true);
                                    try {
                                      const thumbBlob = await generateThumbnailFromUrl(formData.video_url);
                                      const thumbFile = new File([thumbBlob], `thumb-${Date.now()}.jpg`, { type: 'image/jpeg' });

                                      const thumbResult = await videosApi.uploadThumbnail(thumbFile);

                                      setFormData(prev => ({ ...prev, thumbnail_url: thumbResult.thumbnailUrl }));
                                      toast({ title: '封面已生成' });
                                    } catch (err: any) {
                                      toast({ title: '生成失败', description: err.message, variant: 'destructive' });
                                    } finally {
                                      setUploadingThumbnail(false);
                                    }
                                  }}
                                >
                                  {uploadingThumbnail ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                  <span className="ml-1">从视频生成</span>
                                </Button>
                              )}
                              {/* 手动上传按钮 */}
                              <label>
                                <Button type="button" variant="outline" size="sm" disabled={uploadingThumbnail} asChild>
                                  <span>
                                    <ImagePlus className="w-3 h-3 mr-1" />
                                    上传图片
                                  </span>
                                </Button>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setUploadingThumbnail(true);
                                    try {
                                      const thumbResult = await videosApi.uploadThumbnail(file);
                                      setFormData(prev => ({ ...prev, thumbnail_url: thumbResult.thumbnailUrl }));
                                      toast({ title: '封面已上传' });
                                    } catch (err: any) {
                                      toast({ title: '上传失败', description: err.message, variant: 'destructive' });
                                    } finally {
                                      setUploadingThumbnail(false);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SRT Upload */}
                  <div className="space-y-2">
                    <Label className="font-semibold text-primary">2. 上传双语字幕 (.srt)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".srt"
                        disabled={parsing}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          setParsing(true);
                          try {
                            const text = await file.text();
                            const { en, cn } = parseBilingualSRT(text);

                            setFormData(prev => ({
                              ...prev,
                              subtitles_en: en,
                              subtitles_cn: cn
                            }));

                            toast({ title: '字幕解析成功', description: '已自动分离中英文字幕并保存' });
                          } catch (error: any) {
                            toast({ title: '解析失败', description: error.message, variant: 'destructive' });
                          } finally {
                            setParsing(false);
                          }
                        }}
                      />
                      {parsing && <Loader2 className="animate-spin w-4 h-4" />}
                    </div>
                    {/* Status Indicator */}
                    <div className="flex gap-4 text-xs mt-1">
                      <span className={formData.subtitles_en ? "text-green-600 flex items-center gap-1" : "text-muted-foreground flex items-center gap-1"}>
                        {formData.subtitles_en ? <CheckCircle2 className="w-3 h-3" /> : null}
                        {formData.subtitles_en ? "英文字幕已就绪" : "等待解析英文字幕"}
                      </span>
                      <span className={formData.subtitles_cn ? "text-green-600 flex items-center gap-1" : "text-muted-foreground flex items-center gap-1"}>
                        {formData.subtitles_cn ? <CheckCircle2 className="w-3 h-3" /> : null}
                        {formData.subtitles_cn ? "中文字幕已就绪" : "等待解析中文字幕"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_published"
                    checked={formData.is_published}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                  />
                  <Label htmlFor="is_published">发布</Label>
                </div>
                <Button type="submit" className="w-full">
                  {editingVideo ? '保存' : '创建'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>分类</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>播放量</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.map((video) => (
              <TableRow key={video.id}>
                <TableCell className="font-medium">{video.title}</TableCell>
                <TableCell>
                  {categories.find((c) => c.id === video.category_id)?.name || '-'}
                </TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${video.is_published
                      ? 'bg-green-100 text-green-800'
                      : 'bg-muted text-muted-foreground'
                      }`}
                  >
                    {video.is_published ? '已发布' : '草稿'}
                  </span>
                </TableCell>
                <TableCell>{video.view_count}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(video)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(video.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default AdminVideos;
