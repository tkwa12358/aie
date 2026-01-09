import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileVideo, FileText, Play, ArrowLeft, CheckCircle, Eye, EyeOff, Clock, CheckCircle2, Languages } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { parseSRT, parseBilingualSRT, Subtitle, authCodesApi } from '@/lib/api-client';
import { Header } from '@/components/Header';
import { VideoPlayer, VideoPlayerRef } from '@/components/VideoPlayer';
import { SubtitleList } from '@/components/SubtitleList';
import { ProfessionalAssessment } from '@/components/ProfessionalAssessment';
import { WordLookup } from '@/components/WordLookup';
import { ActivationDialog } from '@/components/ActivationDialog';
import { useAuth } from '@/contexts/AuthContext';

const LocalLearn: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  // 激活状态
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [showActivationDialog, setShowActivationDialog] = useState(false);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [subtitlesEn, setSubtitlesEn] = useState<Subtitle[]>([]);
  const [subtitlesCn, setSubtitlesCn] = useState<Subtitle[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const [practiceSubtitle, setPracticeSubtitle] = useState<Subtitle | null>(null);
  const [practiceSubtitleIndex, setPracticeSubtitleIndex] = useState<number | null>(null);
  const [showWordLookup, setShowWordLookup] = useState(false);
  const [lookupWord, setLookupWord] = useState('');
  const [lookupContext, setLookupContext] = useState('');
  const [isLearning, setIsLearning] = useState(false);
  const [completedSentences, setCompletedSentences] = useState<number[]>([]);
  const [practiceTime, setPracticeTime] = useState(0);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const practiceStartRef = useRef<number | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<VideoPlayerRef>(null);

  // 检查用户是否已激活
  useEffect(() => {
    const checkActivation = async () => {
      if (!user) {
        setIsActivated(null);
        return;
      }

      try {
        const codes = await authCodesApi.getMyAuthCodes();
        const hasAppUnlockCode = codes.some(
          (c: any) => (c.code_type === 'registration' || c.code_type === 'app_unlock') && c.is_used
        );
        setIsActivated(hasAppUnlockCode);
      } catch (error) {
        console.warn('检查激活状态失败:', error);
        setIsActivated(false);
      }
    };
    checkActivation();
  }, [user]);

  // 检查是否可以访问本地学习功能
  const canAccessLocalLearn = useCallback(() => {
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

  const handleVideoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        toast({
          title: '文件格式错误',
          description: '请选择视频文件',
          variant: 'destructive',
        });
        return;
      }
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      toast({
        title: '视频已加载',
        description: file.name,
      });
    }
  }, [toast]);

  // 处理双语 SRT 上传 - 使用和管理后台一致的解析逻辑
  const handleSrtUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const srtContent = event.target?.result as string;

        // 使用和管理后台一致的解析逻辑
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
          const contentLines: string[] = [];
          let j = i + 2;
          while (j < lines.length && lines[j].trim() !== '') {
            contentLines.push(lines[j].trim());
            j++;
          }

          let enLine = '';
          let cnLine = '';

          if (contentLines.length > 0) {
            if (contentLines.length === 1) {
              // Check if contains Chinese
              if (/[\u4e00-\u9fa5]/.test(contentLines[0])) {
                cnLine = contentLines[0];
              } else {
                enLine = contentLines[0];
              }
            } else {
              // First line is English, rest is Chinese
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

        // 使用 parseSRT 解析分离后的字幕
        const enSubtitles = parseSRT(enSRT);
        const cnSubtitles = parseSRT(cnSRT);

        setSubtitlesEn(enSubtitles);
        setSubtitlesCn(cnSubtitles);
        setSrtFile(file);

        if (enSubtitles.length > 0 && cnSubtitles.length > 0) {
          toast({
            title: '双语字幕已加载',
            description: `共 ${enSubtitles.length} 条英文字幕，${cnSubtitles.length} 条中文字幕`,
          });
        } else if (enSubtitles.length > 0) {
          toast({
            title: '英文字幕已加载',
            description: `共 ${enSubtitles.length} 条字幕（未检测到中文翻译）`,
          });
        } else {
          toast({
            title: '字幕解析错误',
            description: '未能识别有效的英文字幕内容',
            variant: 'destructive',
          });
        }
      };
      reader.readAsText(file);
    }
  }, [toast]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
    const current = subtitlesEn.find(s => time >= s.start && time <= s.end);
    if (current) {
      const translation = subtitlesCn.find(s =>
        Math.abs(s.start - current.start) < 1
      )?.text;
      setCurrentSubtitle({ ...current, translation });
    } else {
      setCurrentSubtitle(null);
    }
  }, [subtitlesEn, subtitlesCn]);

  const handleSeek = useCallback((time: number) => {
    if (playerRef.current) {
      playerRef.current.seek(time);
      playerRef.current.play();
    }
  }, []);

  const handlePractice = useCallback((subtitle: Subtitle, index: number) => {
    // 跟读时暂停视频
    if (playerRef.current) {
      playerRef.current.pause();
    }
    setPracticeSubtitle(subtitle);
    setPracticeSubtitleIndex(index);
    if (!practiceStartRef.current) {
      practiceStartRef.current = Date.now();
    }
  }, []);

  const handleAssessmentSuccess = useCallback((score: number) => {
    if (practiceSubtitleIndex !== null && score >= 60) {
      setCompletedSentences(prev => {
        if (prev.includes(practiceSubtitleIndex)) return prev;
        return [...prev, practiceSubtitleIndex].sort((a, b) => a - b);
      });
    }
    // Update practice time
    if (practiceStartRef.current) {
      const elapsed = Math.floor((Date.now() - practiceStartRef.current) / 1000);
      setPracticeTime(prev => prev + elapsed);
      practiceStartRef.current = Date.now();
    }
  }, [practiceSubtitleIndex]);

  const handleWordClick = useCallback((word: string, context: string) => {
    setLookupWord(word);
    setLookupContext(context);
    setShowWordLookup(true);
  }, []);

  const formatPracticeTime = useCallback(() => {
    const totalSeconds = practiceTime;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds}秒`;
    }
    return `${seconds}秒`;
  }, [practiceTime]);

  const startLearning = useCallback(() => {
    // 检查激活状态
    if (!canAccessLocalLearn()) {
      setShowActivationDialog(true);
      return;
    }

    if (!videoUrl) {
      toast({
        title: '请先上传视频',
        variant: 'destructive',
      });
      return;
    }
    if (subtitlesEn.length === 0) {
      toast({
        title: '请上传英文字幕',
        description: '需要英文字幕才能进行学习',
        variant: 'destructive',
      });
      return;
    }
    setIsLearning(true);
    practiceStartRef.current = Date.now();
  }, [videoUrl, subtitlesEn.length, toast, canAccessLocalLearn]);

  if (isLearning) {
    return (
      <>
        <Helmet>
          <title>本地学习 - AI English Club</title>
        </Helmet>
        <div className="min-h-screen gradient-bg dark:gradient-bg-dark">
          <Header />
          <main className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setIsLearning(false)}
                  className="rounded-xl hover:bg-accent/50"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回上传
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTranslation(!showTranslation)}
                  className="rounded-xl hover:bg-accent/50"
                >
                  {showTranslation ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                  {showTranslation ? '隐藏翻译' : '显示翻译'}
                </Button>
              </div>

              {/* 学习进度指示器 */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{formatPracticeTime()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>{completedSentences.length}/{subtitlesEn.length} 句</span>
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
                    videoUrl={videoUrl}
                    subtitles={subtitlesEn}
                    subtitlesCn={subtitlesCn}
                    currentSubtitle={currentSubtitle}
                    onTimeUpdate={handleTimeUpdate}
                    onSubtitleClick={(subtitle) => handleSeek(subtitle.start)}
                    showTranslation={showTranslation}
                    onToggleTranslation={() => setShowTranslation(!showTranslation)}
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
                      {subtitlesEn.length} 条
                    </span>
                  </div>
                  <SubtitleList
                    subtitles={subtitlesEn}
                    subtitlesCn={subtitlesCn}
                    currentSubtitle={currentSubtitle}
                    onSubtitleClick={(subtitle) => handleSeek(subtitle.start)}
                    onPractice={(subtitle) => {
                      const index = subtitlesEn.findIndex(s => s === subtitle);
                      handlePractice(subtitle, index);
                    }}
                    onAddWord={handleWordClick}
                    showTranslation={showTranslation}
                    completedSentences={completedSentences}
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
                  videoUrl={videoUrl}
                  subtitles={subtitlesEn}
                  subtitlesCn={subtitlesCn}
                  currentSubtitle={currentSubtitle}
                  onTimeUpdate={handleTimeUpdate}
                  onSubtitleClick={(subtitle) => handleSeek(subtitle.start)}
                  showTranslation={showTranslation}
                  onToggleTranslation={() => setShowTranslation(!showTranslation)}
                />
              </div>

              {/* 右侧字幕列表 - 高度跟随视频 */}
              <div className="w-full lg:w-1/3 relative z-10">
                <div className="h-[500px] lg:h-full lg:absolute lg:inset-0 glass rounded-2xl overflow-hidden shadow-xl flex flex-col ring-1 ring-white/10">
                  <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <Languages className="w-4 h-4 text-primary" />
                      字幕列表
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                      {subtitlesEn.length} 条
                    </span>
                  </div>
                  <SubtitleList
                    subtitles={subtitlesEn}
                    subtitlesCn={subtitlesCn}
                    currentSubtitle={currentSubtitle}
                    onSubtitleClick={(subtitle) => handleSeek(subtitle.start)}
                    onPractice={(subtitle) => {
                      const index = subtitlesEn.findIndex(s => s === subtitle);
                      handlePractice(subtitle, index);
                    }}
                    onAddWord={handleWordClick}
                    showTranslation={showTranslation}
                    completedSentences={completedSentences}
                  />
                </div>
              </div>
            </div>
          </main>

          {practiceSubtitle && (
            <ProfessionalAssessment
              originalText={practiceSubtitle.text}
              onClose={() => {
                setPracticeSubtitle(null);
                setPracticeSubtitleIndex(null);
                // 关闭后恢复播放
                playerRef.current?.play();
              }}
              onSuccess={handleAssessmentSuccess}
            />
          )}

          {showWordLookup && (
            <WordLookup
              word={lookupWord}
              context={lookupContext}
              onClose={() => setShowWordLookup(false)}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>本地学习 - AI English Club</title>
        <meta name="description" content="上传本地视频和字幕文件进行英语学习" />
      </Helmet>
      <div className="min-h-screen gradient-bg dark:gradient-bg-dark">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Button
              variant="ghost"
              onClick={() => navigate('/learn')}
              className="mb-6 rounded-xl hover:bg-accent/50"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回在线学习
            </Button>

            <div className="glass rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl flex items-center justify-center">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">本地视频学习</h1>
                  <p className="text-sm text-muted-foreground">上传视频和字幕开始学习</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Video Upload */}
                <div className="space-y-2">
                  <Label htmlFor="video" className="text-sm font-medium">视频文件</Label>
                  <Input
                    ref={videoInputRef}
                    id="video"
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => videoInputRef.current?.click()}
                    className={`w-full h-auto py-4 rounded-xl border-dashed border-2 hover:bg-accent/30 ${videoFile ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {videoFile ? (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      ) : (
                        <FileVideo className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className={videoFile ? 'text-primary font-medium' : 'text-muted-foreground'}>
                        {videoFile ? videoFile.name : '点击选择视频文件'}
                      </span>
                    </div>
                  </Button>
                  {videoUrl && (
                    <video
                      src={videoUrl}
                      className="w-full rounded-xl mt-3 shadow-md"
                      style={{ maxHeight: '200px' }}
                      controls
                    />
                  )}
                </div>

                {/* Bilingual SRT Upload */}
                <div className="space-y-2">
                  <Label htmlFor="srt" className="text-sm font-medium">
                    字幕文件 (SRT) <span className="text-destructive">*必需</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    支持双语字幕（第一行英文，第二行中文）或纯英文字幕
                  </p>
                  <Input
                    ref={srtInputRef}
                    id="srt"
                    type="file"
                    accept=".srt"
                    onChange={handleSrtUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => srtInputRef.current?.click()}
                    className={`w-full h-auto py-4 rounded-xl border-dashed border-2 hover:bg-accent/30 ${srtFile ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {srtFile ? (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className={srtFile ? 'text-primary font-medium' : 'text-muted-foreground'}>
                        {srtFile
                          ? `${srtFile.name} (${subtitlesEn.length} 条英文${subtitlesCn.length > 0 ? ` + ${subtitlesCn.length} 条中文` : ''})`
                          : '点击选择字幕文件'}
                      </span>
                    </div>
                  </Button>
                </div>

                <Button
                  className="w-full py-6 text-lg rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg"
                  size="lg"
                  onClick={startLearning}
                  disabled={!videoUrl || subtitlesEn.length === 0}
                >
                  <Play className="h-5 w-5 mr-2" />
                  开始学习
                </Button>
              </div>
            </div>
          </div>
        </main>

        {/* 激活对话框 */}
        <ActivationDialog
          open={showActivationDialog}
          onOpenChange={setShowActivationDialog}
          onActivated={() => {
            setIsActivated(true);
            setShowActivationDialog(false);
          }}
        />
      </div>
    </>
  );
};

export default LocalLearn;