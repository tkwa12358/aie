import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { Header } from '@/components/Header';
import { VideoPlayer, VideoPlayerRef } from '@/components/VideoPlayer';
import { SubtitleList } from '@/components/SubtitleList';
import { ProfessionalAssessment } from '@/components/ProfessionalAssessment';
import { WordLookup } from '@/components/WordLookup';
import { CategoryTabs } from '@/components/CategoryTabs';
import { RecentlyLearned } from '@/components/RecentlyLearned';
import { ActivationDialog } from '@/components/ActivationDialog';
import { Video, Subtitle, videosApi, authCodesApi, parseSRT, parseBilingualSRT, getStorageUrl } from '@/lib/api-client';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, Clock, CheckCircle2, Languages } from 'lucide-react';
import { useLearningProgress } from '@/hooks/useLearningProgress';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';

const Learn = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [subtitlesCn, setSubtitlesCn] = useState<Subtitle[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const playerRef = useRef<VideoPlayerRef>(null);

  // 激活状态检查
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [showActivationDialog, setShowActivationDialog] = useState(false);

  // Initialize showTranslation from localStorage or default to true
  const [showTranslation, setShowTranslation] = useState(() => {
    return localStorage.getItem('showTranslation') !== 'false';
  });
  const [practiceSubtitle, setPracticeSubtitle] = useState<Subtitle | null>(null);
  const [practiceSubtitleIndex, setPracticeSubtitleIndex] = useState<number | null>(null);
  const [lookupWord, setLookupWord] = useState<{ word: string; context: string; contextTranslation: string } | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  // 学习进度追踪
  const {
    progress,
    startTracking,
    pauseTracking,
    savePosition,
    markSentenceCompleted,
    completedCount,
    formatPracticeTime,
    lastPosition,
  } = useLearningProgress(selectedVideo?.id || null);

  useEffect(() => {
    fetchVideos();
  }, []);

  // 用户变化时重置状态（切换账号）
  useEffect(() => {
    setSelectedVideo(null);
    setSubtitles([]);
    setSubtitlesCn([]);
    setCurrentSubtitle(null);
  }, [user?.id]);

  // 检查用户是否已激活（通过API检查是否已使用应用解锁授权码）
  useEffect(() => {
    const checkActivation = async () => {
      if (!user) {
        setIsActivated(null);
        return;
      }

      try {
        const codes = await authCodesApi.getMyAuthCodes();
        // 检查是否有已使用的应用解锁码（registration 或 app_unlock 类型）
        const hasAppUnlockCode = codes.some(
          (c: any) => (c.code_type === 'registration' || c.code_type === 'app_unlock') && c.is_used
        );
        setIsActivated(hasAppUnlockCode);
      } catch (error) {
        // API失败时假设未激活，让试用期逻辑决定
        console.warn('检查激活状态失败:', error);
        setIsActivated(false);
      }
    };
    checkActivation();
  }, [user]);

  // 检查是否可以访问视频
  const canAccessVideo = useCallback(() => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    if (isActivated) return true;

    // 检查试用期（30天）
    const TRIAL_DAYS = 30;
    const registerDate = new Date(profile.created_at);
    const daysSinceRegister = Math.floor(
      (Date.now() - registerDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceRegister < TRIAL_DAYS;
  }, [profile, isActivated]);

  useEffect(() => {
    if (videoId && videos.length > 0) {
      const video = videos.find(v => v.id === videoId);
      if (video) selectVideo(video);
    }
  }, [videoId, videos]);

  const fetchVideos = async () => {
    try {
      const data = await videosApi.getVideos({ published: true });
      // Filter videos with valid video_url
      const validVideos = data.filter(v => v.video_url && v.video_url.trim() !== '');
      setVideos(validVideos);
    } catch (error) {
      console.error('获取视频列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // Effect to load last played video if no videoId in params
  // 只有当用户已登录且稳定后才尝试加载
  useEffect(() => {
    if (user && !videoId && videos.length > 0 && !selectedVideo) {
      const lastVideoId = localStorage.getItem('lastVideoId');
      if (lastVideoId) {
        const lastVideo = videos.find(v => v.id === lastVideoId);
        if (lastVideo) {
          selectVideo(lastVideo);
        }
      }
    }
  }, [videoId, videos, selectedVideo, user]);

  // 监听导航事件：当用户点击"视频学习"按钮回到列表时重置状态
  useEffect(() => {
    // 如果 URL 是 /learn（无 videoId）且 localStorage 没有 lastVideoId，则重置 selectedVideo
    if (location.pathname === '/learn' && !videoId && selectedVideo) {
      const lastVideoId = localStorage.getItem('lastVideoId');
      if (!lastVideoId) {
        pauseTracking();
        savePosition(currentTime);
        setSelectedVideo(null);
        setSubtitles([]);
        setSubtitlesCn([]);
        setCurrentSubtitle(null);
      }
    }
  }, [location.key]); // 监听 location.key 以检测导航事件

  // Persist showTranslation preference
  useEffect(() => {
    localStorage.setItem('showTranslation', showTranslation.toString());
  }, [showTranslation]);

  const selectVideo = (video: Video) => {
    // 检查是否可以访问视频
    if (!canAccessVideo()) {
      setShowActivationDialog(true);
      return;
    }

    // 保存当前视频的进度（如果有）
    if (selectedVideo) {
      pauseTracking();
      savePosition(currentTime);
    }

    setSelectedVideo(video);
    // Persist last played video
    localStorage.setItem('lastVideoId', video.id);

    // 处理字幕：优先使用分离的字幕，如果没有中文字幕则尝试解析双语格式
    if (video.subtitles_en) {
      if (video.subtitles_cn) {
        // 有分离的中英文字幕
        setSubtitles(parseSRT(video.subtitles_en));
        setSubtitlesCn(parseSRT(video.subtitles_cn));
      } else {
        // 尝试解析双语格式（英文+中文在同一个SRT文件中）
        const { en, cn } = parseBilingualSRT(video.subtitles_en);
        if (cn.length > 0) {
          // 双语格式成功解析
          setSubtitles(en);
          setSubtitlesCn(cn);
        } else {
          // 纯英文字幕
          setSubtitles(parseSRT(video.subtitles_en));
          setSubtitlesCn([]);
        }
      }
    } else {
      setSubtitles([]);
      setSubtitlesCn([]);
    }
  };

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
    const current = subtitles.find(s => time >= s.start && time <= s.end);
    setCurrentSubtitle(current || null);

    // 每30秒自动保存进度
    const now = Date.now();
    if (now - lastSaveTimeRef.current > 30000) {
      savePosition(time);
      lastSaveTimeRef.current = now;
    }
  }, [subtitles, savePosition]);

  const handleSubtitleClick = (subtitle: Subtitle) => {
    setCurrentSubtitle(subtitle);
    if (playerRef.current) {
      playerRef.current.seek(subtitle.start);
      playerRef.current.play();
    }
  };

  // 处理跟读练习 - 直接打开专业评测
  const handlePractice = useCallback((subtitle: Subtitle, index: number) => {
    // Pause video when practicing
    if (playerRef.current) {
      playerRef.current.pause();
    }
    setPracticeSubtitle(subtitle);
    setPracticeSubtitleIndex(index);
  }, []);

  // 评测成功回调
  const handleAssessmentSuccess = useCallback((score: number) => {
    if (practiceSubtitleIndex !== null && score >= 60) {
      markSentenceCompleted(practiceSubtitleIndex);
    }
  }, [practiceSubtitleIndex, markSentenceCompleted]);

  // 页面卸载时保存进度
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (selectedVideo) {
        pauseTracking();
        savePosition(currentTime);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedVideo, currentTime, pauseTracking, savePosition]);

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg dark:gradient-bg-dark flex items-center justify-center">
        <div className="glass p-8 rounded-2xl">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{selectedVideo?.title || '视频学习'} - AI English Club</title>
      </Helmet>

      <div className="min-h-screen gradient-bg dark:gradient-bg-dark flex flex-col">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-6">
          {!selectedVideo ? (
            // Video List with Categories and Recent Learning
            <div>
              {/* 分类标签栏 */}
              <CategoryTabs
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onLocalLearningClick={() => navigate('/local-learn')}
              />

              {/* 继续学习区域 */}
              <RecentlyLearned onSelectVideo={selectVideo} />

              {/* 推荐视频标题 */}
              <h2 className="text-lg font-semibold mb-4">推荐视频</h2>

              {/* 视频列表 */}
              {videos.length === 0 ? (
                <div className="glass p-12 rounded-2xl text-center">
                  <p className="text-muted-foreground">暂无可用视频</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {videos
                    .filter(video =>
                      selectedCategory === null || video.category_id === selectedCategory
                    )
                    .map(video => (
                      <div
                        key={video.id}
                        className="glass rounded-2xl overflow-hidden cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1 group"
                        onClick={() => selectVideo(video)}
                      >
                        <div className="aspect-video bg-muted/50 flex items-center justify-center relative">
                          {video.thumbnail_url ? (
                            <img src={getStorageUrl(video.thumbnail_url)} alt={video.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-4xl">🎬</span>
                          )}
                          {/* 播放悬浮层 */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-14 h-14 bg-primary/90 rounded-full flex items-center justify-center">
                              <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                          {/* 时长标签 */}
                          {video.duration && (
                            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-xs text-white">
                              {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold text-lg mb-1 line-clamp-1">{video.title}</h3>
                          <p className="text-sm text-muted-foreground truncate">{video.description}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* 筛选后无结果提示 */}
              {selectedCategory !== null && videos.filter(v => v.category_id === selectedCategory).length === 0 && (
                <div className="glass p-8 rounded-2xl text-center mt-4">
                  <p className="text-muted-foreground">该分类下暂无视频</p>
                </div>
              )}
            </div>
          ) : (
            // Video Player View - PC左右布局，移动端上下布局
            <div className="flex flex-col gap-4">
              {/* 顶部统一控制栏 (Header Bar) */}
              <div className="flex items-center justify-between bg-card/30 backdrop-blur p-3 rounded-2xl border border-white/10 shadow-sm">

                {/* 左侧：返回按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    pauseTracking();
                    savePosition(currentTime);
                    localStorage.removeItem('lastVideoId');
                    setSelectedVideo(null);
                  }}
                  className="rounded-xl hover:bg-accent/50 gap-2 font-medium"
                >
                  <ChevronLeft className="w-4 h-4" />
                  返回列表
                </Button>

                {/* 右侧：统计信息 */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-background/50 rounded-full border border-border/50">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>{formatPracticeTime()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-background/50 rounded-full border border-border/50">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-foreground">{completedCount}</span>
                    <span className="text-xs">/{subtitles.length} 句</span>
                  </div>
                </div>
              </div>

              {/* 移动端布局：视频固定 + 悬浮字幕 + 字幕列表 */}
              <div className="lg:hidden flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
                {/* 视频区域 - sticky 固定在顶部 */}
                <div className="sticky top-0 z-30 bg-background shrink-0">
                  <div className="glass rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                    <VideoPlayer
                      ref={playerRef}
                      videoUrl={getStorageUrl(selectedVideo.video_url)}
                      subtitles={subtitles}
                      subtitlesCn={subtitlesCn}
                      currentSubtitle={currentSubtitle}
                      onTimeUpdate={handleTimeUpdate}
                      onSubtitleClick={handleSubtitleClick}
                      showTranslation={showTranslation}
                      onToggleTranslation={() => setShowTranslation(!showTranslation)}
                      onPlay={startTracking}
                      onPause={() => {
                        pauseTracking();
                        savePosition(currentTime);
                      }}
                    />
                  </div>

                  {/* 当前字幕悬浮条 */}
                  {currentSubtitle && (
                    <div className="bg-black/80 backdrop-blur text-white p-3 text-center">
                      <p className="text-sm font-medium">{currentSubtitle.text}</p>
                      {showTranslation && subtitlesCn.find(s => Math.abs(s.start - currentSubtitle.start) < 0.5)?.text && (
                        <p className="text-xs text-gray-300 mt-1">
                          {subtitlesCn.find(s => Math.abs(s.start - currentSubtitle.start) < 0.5)?.text}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 字幕列表 - 可独立滚动 */}
                <div className="flex-1 overflow-hidden mt-3">
                  <div className="h-full glass rounded-2xl overflow-hidden shadow-xl flex flex-col ring-1 ring-white/10">
                    <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm shrink-0">
                      <span className="text-sm font-semibold flex items-center gap-2">
                        <Languages className="w-4 h-4 text-primary" />
                        字幕列表
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                        {subtitles.length} 条
                      </span>
                    </div>
                    <SubtitleList
                      subtitles={subtitles}
                      subtitlesCn={subtitlesCn}
                      currentSubtitle={currentSubtitle}
                      onSubtitleClick={handleSubtitleClick}
                      onPractice={(subtitle) => {
                        const index = subtitles.findIndex(s => s === subtitle);
                        handlePractice(subtitle, index);
                      }}
                      onAddWord={(word, context, contextTranslation) => setLookupWord({ word, context, contextTranslation })}
                      showTranslation={showTranslation}
                      completedSentences={progress?.completed_sentences || []}
                    />
                  </div>
                </div>
              </div>

              {/* 桌面端布局：左右分栏 */}
              <div className="hidden lg:flex flex-row gap-6 lg:items-stretch">
                {/* 左侧视频区域 */}
                <div className="w-full lg:w-2/3 glass rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 flex flex-col relative z-20">
                  <VideoPlayer
                    ref={playerRef}
                    videoUrl={getStorageUrl(selectedVideo.video_url)}
                    subtitles={subtitles}
                    subtitlesCn={subtitlesCn}
                    currentSubtitle={currentSubtitle}
                    onTimeUpdate={handleTimeUpdate}
                    onSubtitleClick={handleSubtitleClick}
                    showTranslation={showTranslation}
                    onToggleTranslation={() => setShowTranslation(!showTranslation)}
                    onPlay={startTracking}
                    onPause={() => {
                      pauseTracking();
                      savePosition(currentTime);
                    }}
                  />
                </div>

                {/* 右侧字幕列表 */}
                <div className="w-full lg:w-1/3 relative z-10">
                  <div className="h-[500px] lg:h-full lg:absolute lg:inset-0 glass rounded-2xl overflow-hidden shadow-xl flex flex-col ring-1 ring-white/10">
                    <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm">
                      <span className="text-sm font-semibold flex items-center gap-2">
                        <Languages className="w-4 h-4 text-primary" />
                        字幕列表
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                        {subtitles.length} 条
                      </span>
                    </div>
                    <SubtitleList
                      subtitles={subtitles}
                      subtitlesCn={subtitlesCn}
                      currentSubtitle={currentSubtitle}
                      onSubtitleClick={handleSubtitleClick}
                      onPractice={(subtitle) => {
                        const index = subtitles.findIndex(s => s === subtitle);
                        handlePractice(subtitle, index);
                      }}
                      onAddWord={(word, context, contextTranslation) => setLookupWord({ word, context, contextTranslation })}
                      showTranslation={showTranslation}
                      completedSentences={progress?.completed_sentences || []}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </main >
      </div >

      {/* 专业评测 */}
      {
        practiceSubtitle && (
          <ProfessionalAssessment
            originalText={practiceSubtitle.text}
            videoId={selectedVideo?.id}
            onClose={() => {
              setPracticeSubtitle(null);
              setPracticeSubtitleIndex(null);
              playerRef.current?.play(); // Resume on close
            }}
            onSuccess={handleAssessmentSuccess}
          />
        )
      }

      {/* 查词 */}
      {
        lookupWord && (
          <ErrorBoundary fallback={
            <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-card p-6 border rounded-lg shadow-lg text-center">
                <p className="mb-4 font-medium">查词遇到问题 ({lookupWord.word})</p>
                <Button onClick={() => setLookupWord(null)}>关闭</Button>
              </div>
            </div>
          }>
            <WordLookup
              word={lookupWord.word}
              context={lookupWord.context}
              contextTranslation={lookupWord.contextTranslation}
              onClose={() => setLookupWord(null)}
            />
          </ErrorBoundary>
        )
      }

      {/* 激活提示弹窗 */}
      <ActivationDialog
        open={showActivationDialog}
        onOpenChange={setShowActivationDialog}
        onActivated={() => {
          setIsActivated(true);
          setShowActivationDialog(false);
        }}
      />
    </>
  );
};

export default Learn;