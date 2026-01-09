import { useState, useEffect, useCallback } from 'react';
import { learningApi, UserStatistics, DailyStatistics } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

// 导出类型供外部使用
export type { UserStatistics, DailyStatistics };

// 内部转换的统计类型（与数据库字段名兼容）
interface InternalStatistics {
  id?: string;
  user_id?: string;
  total_watch_time: number;
  total_practice_time: number;
  today_watch_time: number;
  today_practice_time: number;
  total_videos_watched: number;
  total_sentences_completed: number;
  total_words_learned: number;
  total_assessments: number;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  created_at?: string;
  updated_at?: string;
}

interface InternalDailyStatistics {
  id: string;
  user_id: string;
  study_date: string;
  watch_time: number;
  practice_time: number;
  sentences_completed: number;
  words_learned: number;
  videos_watched: number;
  created_at?: string;
}

export const useUserStatistics = () => {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<InternalStatistics | null>(null);
  const [dailyStats, setDailyStats] = useState<InternalDailyStatistics[]>([]);
  const [loading, setLoading] = useState(true);

  // 将 API 返回的驼峰命名转换为下划线命名（兼容旧代码）
  const convertStats = (data: UserStatistics): InternalStatistics => ({
    total_watch_time: data.totalWatchTime || 0,
    total_practice_time: data.totalPracticeTime || 0,
    today_watch_time: data.todayWatchTime || 0,
    today_practice_time: data.todayPracticeTime || 0,
    total_videos_watched: data.totalVideosWatched || 0,
    total_sentences_completed: data.totalSentencesCompleted || 0,
    total_words_learned: data.totalWordsLearned || 0,
    total_assessments: data.totalAssessments || 0,
    current_streak: data.currentStreak || 0,
    longest_streak: data.longestStreak || 0,
    last_study_date: data.lastStudyDate || null,
  });

  // 获取用户统计数据
  const fetchStatistics = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // 获取用户汇总统计
      const statsData = await learningApi.getStatistics();
      setStatistics(convertStats(statsData));

      // 获取最近90天的每日统计
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const dailyData = await learningApi.getDailyStatistics({
        startDate: ninetyDaysAgo.toISOString().split('T')[0],
        limit: 90
      });

      // 转换每日统计数据格式
      const convertedDaily: InternalDailyStatistics[] = dailyData.map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        study_date: d.study_date,
        watch_time: d.watch_time || 0,
        practice_time: d.practice_time || 0,
        sentences_completed: d.sentences_completed || 0,
        words_learned: d.words_learned || 0,
        videos_watched: d.videos_watched || 0,
        created_at: d.created_at,
      }));

      setDailyStats(convertedDaily);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  // 刷新统计数据
  const refresh = useCallback(() => {
    setLoading(true);
    fetchStatistics();
  }, [fetchStatistics]);

  // 格式化时间显示
  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  }, []);

  // 格式化简短时间（用于徽章等）
  const formatShortTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h${minutes}m`;
    }
    return `${minutes}m`;
  }, []);

  // 获取总学习时长（观看+跟读）
  const getTotalLearningTime = useCallback(() => {
    if (!statistics) return 0;
    return statistics.total_watch_time + statistics.total_practice_time;
  }, [statistics]);

  // 获取今日学习时长
  const getTodayLearningTime = useCallback(() => {
    if (!statistics) return 0;
    return statistics.today_watch_time + statistics.today_practice_time;
  }, [statistics]);

  // 生成日历数据（用于学习日历组件）
  const getCalendarData = useCallback(() => {
    const today = new Date();
    const calendarData: { date: string; practiceTime: number; completedSentences: number }[] = [];

    // 生成90天的日历数据
    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayStats = dailyStats.find(d => d.study_date === dateStr);
      calendarData.push({
        date: dateStr,
        practiceTime: dayStats ? (dayStats.watch_time + dayStats.practice_time) : 0,
        completedSentences: dayStats?.sentences_completed || 0,
      });
    }

    return calendarData;
  }, [dailyStats]);

  // 生成最近7天活动数据
  const getRecentActivity = useCallback(() => {
    const today = new Date();
    const recentActivity: { date: string; practiceTime: number; completedSentences: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayStats = dailyStats.find(d => d.study_date === dateStr);
      recentActivity.push({
        date: dateStr,
        practiceTime: dayStats ? (dayStats.watch_time + dayStats.practice_time) : 0,
        completedSentences: dayStats?.sentences_completed || 0,
      });
    }

    return recentActivity;
  }, [dailyStats]);

  return {
    statistics,
    dailyStats,
    loading,
    refresh,
    formatTime,
    formatShortTime,
    getTotalLearningTime,
    getTodayLearningTime,
    getCalendarData,
    getRecentActivity,
  };
};
