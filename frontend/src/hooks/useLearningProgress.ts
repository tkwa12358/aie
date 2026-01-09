import { useState, useEffect, useCallback, useRef } from 'react';
import { learningApi, LearningProgress as ApiLearningProgress } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

export interface LearningProgress {
  id?: string;
  video_id: string | null;
  last_position: number;
  completed_sentences: number[];
  total_practice_time: number;
  updated_at?: string;
}

export const useLearningProgress = (videoId: string | null) => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);
  const lastSaveTimeRef = useRef<number>(0);
  const isNewVideoRef = useRef<boolean>(false);

  // 获取学习进度
  const fetchProgress = useCallback(async () => {
    if (!user || !videoId) {
      setLoading(false);
      return;
    }

    // 重置计时器状态
    startTimeRef.current = null;

    try {
      const data = await learningApi.getProgress(videoId) as ApiLearningProgress;
      if (data && data.video_id) {
        setProgress({
          id: data.id,
          video_id: data.video_id,
          last_position: data.last_position || 0,
          completed_sentences: data.completed_sentences || [],
          total_practice_time: data.total_practice_time || 0,
        });
        accumulatedTimeRef.current = data.total_practice_time || 0;
        isNewVideoRef.current = false;
      } else {
        // 新视频
        isNewVideoRef.current = true;
        accumulatedTimeRef.current = 0;
      }
    } catch (error) {
      // 新视频或获取失败
      isNewVideoRef.current = true;
      accumulatedTimeRef.current = 0;
    }
    setLoading(false);
  }, [user, videoId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // 开始计时（观看视频时调用）
  const startTracking = useCallback(() => {
    // 只有在没有计时时才开始新的计时
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
      console.log('[LearningProgress] startTracking:', startTimeRef.current);
    }
  }, []);

  // 暂停计时并累加时间
  const pauseTracking = useCallback(() => {
    if (startTimeRef.current) {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      accumulatedTimeRef.current += elapsed;
      console.log('[LearningProgress] pauseTracking: elapsed=', elapsed, 'accumulated=', accumulatedTimeRef.current);
      startTimeRef.current = null;
    }
  }, []);

  // 获取当前累计观看时长（包括正在计时的时间）
  const getCurrentWatchTime = useCallback(() => {
    let total = accumulatedTimeRef.current;
    if (startTimeRef.current) {
      total += Math.floor((Date.now() - startTimeRef.current) / 1000);
    }
    return total;
  }, []);

  // 保存播放位置和观看时长
  const savePosition = useCallback(async (position: number) => {
    if (!user || !videoId) return;

    // 计算本次新增的观看时长
    const currentTime = getCurrentWatchTime();
    const previousTime = progress?.total_practice_time || 0;
    const newWatchTime = Math.max(0, currentTime - previousTime);

    console.log('[LearningProgress] savePosition: position=', position, 'currentTime=', currentTime, 'previousTime=', previousTime, 'newWatchTime=', newWatchTime);

    try {
      await learningApi.updateProgress({
        videoId,
        lastPosition: Math.floor(position),
        practiceTime: newWatchTime,
        completedSentences: progress?.completed_sentences || [],
      });

      // 更新本地状态
      setProgress(prev => ({
        ...prev,
        video_id: videoId,
        last_position: Math.floor(position),
        total_practice_time: currentTime,
        completed_sentences: prev?.completed_sentences || [],
      }));

      isNewVideoRef.current = false;
    } catch (error) {
      console.error('Failed to save position:', error);
    }

    lastSaveTimeRef.current = Date.now();
  }, [user, videoId, progress, getCurrentWatchTime]);

  // 标记句子为已完成
  const markSentenceCompleted = useCallback(async (sentenceIndex: number) => {
    if (!user || !videoId) return;

    const currentCompleted = progress?.completed_sentences || [];
    if (currentCompleted.includes(sentenceIndex)) return;

    const newCompleted = [...currentCompleted, sentenceIndex].sort((a, b) => a - b);

    try {
      await learningApi.updateProgress({
        videoId,
        completedSentences: newCompleted,
      });

      setProgress(prev => ({
        ...prev,
        video_id: videoId,
        last_position: prev?.last_position || 0,
        total_practice_time: prev?.total_practice_time || 0,
        completed_sentences: newCompleted,
      }));

      // 更新用户统计
      await learningApi.updateStatistics({
        sentencesCompleted: 1,
      });
    } catch (error) {
      console.error('Failed to mark sentence completed:', error);
    }
  }, [user, videoId, progress]);

  // 记录跟读练习时长
  const recordPracticeTime = useCallback(async (practiceSeconds: number) => {
    if (!user || practiceSeconds <= 0) return;

    try {
      await learningApi.updateStatistics({
        practiceTime: practiceSeconds,
      });
    } catch (error) {
      console.error('Failed to update practice time:', error);
    }
  }, [user]);

  // 获取已完成句子数量
  const completedCount = progress?.completed_sentences?.length || 0;

  // 格式化学习时长
  const formatPracticeTime = useCallback(() => {
    const totalSeconds = getCurrentWatchTime();
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds}秒`;
    }
    return `${seconds}秒`;
  }, [getCurrentWatchTime]);

  return {
    progress,
    loading,
    startTracking,
    pauseTracking,
    savePosition,
    markSentenceCompleted,
    recordPracticeTime,
    completedCount,
    totalPracticeTime: accumulatedTimeRef.current,
    formatPracticeTime,
    lastPosition: progress?.last_position || 0,
    getCurrentWatchTime,
  };
};
