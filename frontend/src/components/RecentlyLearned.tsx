import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { learningApi, Video, getStorageUrl } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { Play, Clock, Upload } from 'lucide-react';

interface LearningRecord {
    video_id: string;
    video?: Video;
    last_position: number;
    total_practice_time: number;
    updated_at: string;
    progress_percent?: number;
}

interface RecentlyLearnedProps {
    onSelectVideo: (video: Video) => void;
}

export const RecentlyLearned: React.FC<RecentlyLearnedProps> = ({
    onSelectVideo,
}) => {
    const { user } = useAuth();
    const [records, setRecords] = useState<LearningRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchRecentRecords();
        }
    }, [user]);

    const fetchRecentRecords = async () => {
        if (!user) return;

        try {
            // 使用 learningApi 获取最近学习记录（包含视频信息）
            const recentData = await learningApi.getRecentVideos(1);

            if (recentData && recentData.length > 0) {
                const enrichedRecords = recentData.map((record: any) => {
                    const video = record.video || {
                        id: record.video_id,
                        title: record.video_title || '未知视频',
                        thumbnail_url: record.thumbnail_url,
                        duration: record.duration || 0
                    };

                    // 计算进度百分比
                    const duration = video.duration || 0;
                    const progress_percent =
                        duration > 0
                            ? Math.min(100, Math.round((record.last_position / duration) * 100))
                            : 0;

                    return {
                        video_id: record.video_id,
                        video: video as Video,
                        last_position: record.last_position || 0,
                        total_practice_time: record.total_practice_time || 0,
                        updated_at: record.updated_at || new Date().toISOString(),
                        progress_percent,
                    };
                });

                setRecords(enrichedRecords);
            }
        } catch (error) {
            console.error('Error fetching recent records:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '昨天';
        if (diffDays < 7) return `${diffDays}天前`;
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    };

    // 如果没有记录，不显示此区域
    if (loading) {
        return (
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        继续学习
                    </h2>
                </div>
                <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="flex-shrink-0 w-64 h-36 bg-card/30 rounded-xl animate-pulse"
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (records.length === 0) {
        return null;
    }

    return (
        <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    继续学习
                </h2>
            </div>

            <div
                className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {records.map((record) => (
                    <div
                        key={record.video_id}
                        onClick={() => record.video && onSelectVideo(record.video)}
                        className="flex-shrink-0 w-[212px] glass rounded-2xl overflow-hidden cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1 group"
                    >
                        {/* 缩略图 */}
                        <div className="relative aspect-video bg-muted/30">
                            {record.video?.thumbnail_url ? (
                                <img
                                    src={getStorageUrl(record.video.thumbnail_url)}
                                    alt={record.video.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-3xl">🎬</span>
                                </div>
                            )}

                            {/* 播放图标悬浮层 */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="w-12 h-12 bg-primary/90 rounded-full flex items-center justify-center">
                                    <Play className="w-6 h-6 text-primary-foreground ml-1" />
                                </div>
                            </div>

                            {/* 进度条 */}
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                                <div
                                    className="h-full bg-primary transition-all"
                                    style={{ width: `${record.progress_percent || 0}%` }}
                                />
                            </div>

                            {/* 进度标签 */}
                            <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 rounded text-xs text-white">
                                {record.progress_percent || 0}%
                            </div>
                        </div>

                        {/* 信息区域 */}
                        <div className="p-3">
                            <h3 className="font-medium text-sm line-clamp-1 mb-1">
                                {record.video?.title}
                            </h3>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{formatDate(record.updated_at)}</span>
                                <span>学习 {formatTime(record.total_practice_time)}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {/* 选择本地视频入口 */}
                <Link
                    to="/local-learn"
                    className="flex-shrink-0 w-[212px] rounded-2xl overflow-hidden cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1 border-2 border-dashed border-primary/50 bg-primary/5 flex flex-col items-center justify-center gap-3"
                    style={{ minHeight: '160px' }}
                >
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-primary">选择本地视频</span>
                </Link>
            </div>
        </div>
    );
};

export default RecentlyLearned;
