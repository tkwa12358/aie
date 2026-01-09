import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Helmet } from 'react-helmet-async';
import { wordsApi } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserStatistics } from '@/hooks/useUserStatistics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Clock, CheckCircle2, BookOpen, TrendingUp, Award, ChevronLeft, Flame, Video, HelpCircle, ChevronDown } from 'lucide-react';
import { LearningCalendar } from '@/components/LearningCalendar';

const Statistics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    statistics,
    loading,
    formatTime,
    getTotalLearningTime,
    getTodayLearningTime,
    getCalendarData,
    getRecentActivity,
  } = useUserStatistics();

  // 额外获取单词本统计（用于掌握度计算）
  const [wordStats, setWordStats] = useState({ total: 0, mastered: 0 });
  const [showScoringRules, setShowScoringRules] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWordStats();
    }
  }, [user]);

  const fetchWordStats = async () => {
    if (!user) return;

    try {
      const data = await wordsApi.getWords();

      if (data) {
        setWordStats({
          total: data.length,
          mastered: data.filter(w => w.mastery_level >= 3).length,
        });
      }
    } catch (error) {
      console.error('Failed to fetch word stats:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg dark:gradient-bg-dark flex items-center justify-center">
        <div className="glass p-8 rounded-2xl">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const masteryProgress = wordStats.total ? (wordStats.mastered / wordStats.total) * 100 : 0;
  const calendarData = getCalendarData();
  const recentActivity = getRecentActivity();

  return (
    <>
      <Helmet>
        <title>学习统计 - AI English Club</title>
        <meta name="description" content="查看您的英语学习进度和统计数据" />
      </Helmet>

      <div className="min-h-screen gradient-bg dark:gradient-bg-dark flex flex-col">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-6">
          {/* 返回按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/learn')}
            className="mb-4 rounded-xl hover:bg-accent/50 gap-2 font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            返回列表
          </Button>

          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-2xl font-bold">学习统计 Statistics</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowScoringRules(!showScoringRules)}
              className="rounded-xl gap-1 text-xs"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              记分原则
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showScoringRules ? 'rotate-180' : ''}`} />
            </Button>
          </div>

          {/* 记分原则说明 */}
          {showScoringRules && (
            <Card className="glass border-border/30 mb-6 bg-blue-50/50 dark:bg-blue-950/20">
              <CardContent className="py-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Video className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span><strong>视频数：</strong>打开一个之前没看过的视频，暂停后统计 +1</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <BookOpen className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span><strong>词汇量：</strong>点击字幕中的单词，添加到单词本，统计 +1</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span><strong>完成句数：</strong>完成一次跟读评测，得分 ≥ 60 分，统计 +1</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}

          {/* 今日学习概览 */}
          <Card className="glass border-border/30 mb-6 bg-gradient-to-r from-primary/10 to-accent/10">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                    <Flame className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">今日学习</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatTime(getTodayLearningTime())}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">连续学习</p>
                  <p className="text-2xl font-bold">
                    {statistics?.current_streak || 0} <span className="text-sm font-normal">天</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 概览卡片 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="glass border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  总学习时长
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatTime(getTotalLearningTime())}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  观看 {formatTime(statistics?.total_watch_time || 0)} + 跟读 {formatTime(statistics?.total_practice_time || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  完成句数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {statistics?.total_sentences_completed || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  评测 {statistics?.total_assessments || 0} 次
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  词汇量
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {wordStats.total}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  已掌握 {wordStats.mastered} 个
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  学习视频
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {statistics?.total_videos_watched || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Videos Studied</p>
              </CardContent>
            </Card>
          </div>

          {/* 学习日历和详细统计 */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* 学习日历 */}
            <Card className="glass border-border/30">
              <CardHeader>
                <CardTitle>学习日历 Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <LearningCalendar
                  activityData={calendarData}
                  currentStreak={statistics?.current_streak || 0}
                  longestStreak={statistics?.longest_streak || 0}
                />
              </CardContent>
            </Card>

            {/* 单词掌握度 */}
            <Card className="glass border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  单词掌握度 Mastery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>已掌握 Mastered</span>
                      <span className="font-medium">{wordStats.mastered} / {wordStats.total}</span>
                    </div>
                    <Progress value={masteryProgress} className="h-3" />
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/30">
                    <div className="text-center">
                      <div className="text-lg font-bold text-primary">{wordStats.mastered}</div>
                      <div className="text-xs text-muted-foreground">掌握</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-accent">{wordStats.total - wordStats.mastered}</div>
                      <div className="text-xs text-muted-foreground">学习中</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">{Math.round(masteryProgress)}%</div>
                      <div className="text-xs text-muted-foreground">掌握率</div>
                    </div>
                  </div>

                  {/* 近7天活动 */}
                  <div className="pt-4 border-t border-border/30">
                    <h4 className="text-sm font-medium mb-3">近7天学习 Weekly</h4>
                    <div className="space-y-2">
                      {recentActivity.map((day, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="w-10 text-xs text-muted-foreground">
                            {formatDate(day.date)}
                          </div>
                          <div className="flex-1">
                            <div
                              className="h-4 bg-primary/30 rounded-sm"
                              style={{
                                width: `${Math.min(100, (day.practiceTime / 1800) * 100)}%`,
                                minWidth: day.practiceTime > 0 ? '8px' : '2px'
                              }}
                            />
                          </div>
                          <div className="w-12 text-right text-xs text-muted-foreground">
                            {Math.floor(day.practiceTime / 60)}分
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 学习成就 */}
          <Card className="glass border-border/30 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                学习成就 Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className={`p-4 rounded-xl border text-center ${(statistics?.current_streak || 0) >= 7 ? 'bg-primary/10 border-primary/30' : 'bg-muted/30 border-border/30'}`}>
                  <div className="text-2xl mb-1">🔥</div>
                  <div className="text-sm font-medium">坚持一周</div>
                  <div className="text-xs text-muted-foreground">连续学习7天</div>
                </div>
                <div className={`p-4 rounded-xl border text-center ${(statistics?.total_sentences_completed || 0) >= 100 ? 'bg-primary/10 border-primary/30' : 'bg-muted/30 border-border/30'}`}>
                  <div className="text-2xl mb-1">💯</div>
                  <div className="text-sm font-medium">百句达人</div>
                  <div className="text-xs text-muted-foreground">完成100个句子</div>
                </div>
                <div className={`p-4 rounded-xl border text-center ${wordStats.total >= 50 ? 'bg-primary/10 border-primary/30' : 'bg-muted/30 border-border/30'}`}>
                  <div className="text-2xl mb-1">📚</div>
                  <div className="text-sm font-medium">词汇收集者</div>
                  <div className="text-xs text-muted-foreground">收集50个单词</div>
                </div>
                <div className={`p-4 rounded-xl border text-center ${getTotalLearningTime() >= 3600 ? 'bg-primary/10 border-primary/30' : 'bg-muted/30 border-border/30'}`}>
                  <div className="text-2xl mb-1">⏱️</div>
                  <div className="text-sm font-medium">学习一小时</div>
                  <div className="text-xs text-muted-foreground">累计学习1小时</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 学习建议 */}
          <Card className="glass border-border/30">
            <CardHeader>
              <CardTitle>学习建议 Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <h4 className="font-medium mb-1">保持连续性</h4>
                  <p className="text-sm text-muted-foreground">每天学习15-30分钟，比偶尔长时间学习更有效</p>
                </div>
                <div className="p-4 bg-accent/5 rounded-xl border border-accent/20">
                  <h4 className="font-medium mb-1">复习单词</h4>
                  <p className="text-sm text-muted-foreground">定期复习单词本中的词汇，提高掌握率</p>
                </div>
                <div className="p-4 bg-secondary/5 rounded-xl border border-secondary/20">
                  <h4 className="font-medium mb-1">多练跟读</h4>
                  <p className="text-sm text-muted-foreground">跟读练习能有效提升口语和听力水平</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
};

export default Statistics;
