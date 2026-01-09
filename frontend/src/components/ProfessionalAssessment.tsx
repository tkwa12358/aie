import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Mic, Square, Loader2, Volume2, Crown, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { assessmentApi, learningApi } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AuthCodeDialog } from '@/components/AuthCodeDialog';
import { MicPermissionGuide } from '@/components/MicPermissionGuide';

interface ProfessionalAssessmentProps {
  originalText: string;
  onClose: () => void;
  videoId?: string;
  onSuccess?: (score: number) => void;
}

interface WordScore {
  word: string;
  accuracy_score: number;
  error_type?: string;
  phonemes?: Array<{
    phoneme: string;
    score: number;
  }>;
}

interface AssessmentResult {
  overall_score: number;
  pronunciation_score: number;
  accuracy_score: number;
  fluency_score: number;
  completeness_score: number;
  feedback: string;
  words_result?: WordScore[];
  remaining_seconds: number;
  seconds_used: number;
  billed: boolean;
  billing_error?: string;
}

export const ProfessionalAssessment = ({
  originalText,
  onClose,
  videoId,
  onSuccess
}: ProfessionalAssessmentProps) => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuthCodeDialog, setShowAuthCodeDialog] = useState(false);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
  const practiceStartTimeRef = useRef<number>(Date.now());

  // 记录跟读练习时长到用户统计
  const recordPracticeTime = async () => {
    if (!user) return;

    const practiceSeconds = Math.floor((Date.now() - practiceStartTimeRef.current) / 1000);
    if (practiceSeconds <= 0) return;

    try {
      await learningApi.updateStatistics({
        todayPracticeTime: practiceSeconds,
        totalAssessments: 1,
      });
    } catch (error) {
      console.error('Failed to record practice time:', error);
    }
  };

  // 组件关闭时记录练习时长
  useEffect(() => {
    return () => {
      // 组件卸载时不自动记录，只在成功评测时记录
    };
  }, []);

  // 获取专业评测剩余时间（数据库直接存储秒数）
  const professionalSeconds = (profile as { professional_voice_minutes?: number })?.professional_voice_minutes || 0;

  const startRecording = async () => {
    if (professionalSeconds <= 0) {
      // 弹出授权码输入框
      setShowAuthCodeDialog(true);
      return;
    }

    // 检查是否在安全上下文中（HTTPS 或 localhost）
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isHttps = window.location.protocol === 'https:';

      if (!isLocalhost && !isHttps) {
        setError(`录音功能需要通过 localhost 或 HTTPS 访问。\n当前地址: ${window.location.host}\n请使用: http://localhost:8080`);
      } else {
        setError('当前浏览器不支持录音功能，请使用 Chrome、Firefox 或 Safari');
      }
      return;
    }

    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      // 检查音轨状态
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0 || !audioTracks[0].enabled) {
        setError('未检测到可用的麦克风');
        return;
      }

      // 检测支持的 mimeType
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // 使用默认
          }
        }
      }

      // 保存实际使用的 mimeType
      mimeTypeRef.current = mimeType || 'audio/webm';

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: unknown) {
      // 检查是否是权限问题
      const errorName = err instanceof Error ? (err as DOMException).name : '';
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        // 权限被拒绝，显示引导弹窗
        setShowPermissionGuide(true);
      } else if (errorName === 'NotFoundError') {
        // 没有找到麦克风设备
        setError('未检测到麦克风设备，请确保麦克风已正确连接');
      } else if (errorName === 'NotReadableError' || errorName === 'AbortError') {
        // 设备被占用或无法读取
        setError('麦克风被其他应用占用，请关闭其他使用麦克风的应用后重试');
      } else {
        // 其他错误
        setError(`录音启动失败: ${errorName || '未知错误'} - ${errorMessage}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // 先请求剩余的数据，确保不会丢失
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.requestData();
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const submitForAssessment = async () => {
    if (!audioBlob) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);

      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result as string;
          const data = await assessmentApi.evaluate(
            originalText,
            base64Audio.split(',')[1],
            videoId
          );

          // 检查是否计费成功
          if (data.billed === false && data.error) {
            // 评测失败，未计费
            setError(data.message || data.error);
            toast({
              variant: 'destructive',
              title: '评测失败',
              description: `${data.message || data.error}`,
            });
          } else {
            // 评测成功
            setResult(data);
            await refreshProfile();

            // 记录跟读练习时长
            await recordPracticeTime();

            if (data.billing_error) {
              toast({
                variant: 'default',
                title: '评测完成',
                description: data.billing_error,
              });
            } else {
              toast({
                title: '专业评测完成',
                description: `总分: ${data.overall_score}分，已扣除${data.seconds_used}秒`,
              });
            }

            if (onSuccess && data.overall_score) {
              onSuccess(data.overall_score);
            }
          }
        } catch (err: any) {
          console.error('Assessment error:', err);
          const message = err.response?.data?.error || err.message || '服务暂时不可用';
          setError(`评测失败: ${message}`);
          toast({
            variant: 'destructive',
            title: '评测失败',
            description: message,
          });
        } finally {
          setIsProcessing(false);
        }
      };
    } catch (err) {
      console.error('Assessment error:', err);
      setError('评测服务暂时不可用，未扣除时间');
      toast({
        variant: 'destructive',
        title: '评测失败',
        description: '服务暂时不可用，未扣除时间',
      });
      setIsProcessing(false);
    }
  };

  const playRecording = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.play();
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getWordBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 border-green-500 text-green-800';
    if (score >= 60) return 'bg-yellow-100 border-yellow-500 text-yellow-800';
    return 'bg-red-100 border-red-500 text-red-800';
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg border-4 border-primary bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">专业语音评测</h2>
          <Badge variant="secondary" className="ml-auto">音素级评分</Badge>
        </div>

        {/* Original Text */}
        <div className="border-2 border-primary p-4 mb-6 bg-primary/5">
          <p className="text-sm text-muted-foreground mb-1">请朗读以下内容：</p>
          <p className="text-lg font-medium">{originalText}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-4 mb-4 bg-destructive/10 border-2 border-destructive text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Recording Controls */}
        {!result && (
          <div className="text-center mb-6">
            {!audioBlob ? (
              <Button
                size="lg"
                className={cn(
                  "w-24 h-24 rounded-full",
                  isRecording && "bg-destructive hover:bg-destructive animate-pulse"
                )}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? (
                  <Square className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={playRecording}>
                    <Volume2 className="w-4 h-4 mr-2" />
                    播放录音
                  </Button>
                  <Button variant="outline" onClick={() => { setAudioBlob(null); setError(null); }}>
                    重新录制
                  </Button>
                </div>
                <Button
                  size="lg"
                  onClick={submitForAssessment}
                  disabled={isProcessing}
                  className="w-full bg-primary"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      专业评测中...
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 mr-2" />
                      提交专业评测
                    </>
                  )}
                </Button>
              </div>
            )}

            <p className="text-sm text-muted-foreground mt-4">
              {isRecording ? '点击停止录音' : audioBlob ? '' : '点击开始录音'}
            </p>
            <p className="text-xs text-primary mt-2 font-medium">
              专业评测剩余: {professionalSeconds}秒
            </p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 mb-6">
            {/* Score Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-primary p-4 text-center bg-primary text-primary-foreground">
                <p className="text-sm opacity-80">总分</p>
                <p className="text-4xl font-bold">
                  {result.overall_score}
                </p>
                <Progress value={result.overall_score} className="mt-2" />
              </div>
              <div className="border-2 border-foreground p-4 text-center">
                <p className="text-sm text-muted-foreground">发音准确</p>
                <p className={cn("text-3xl font-bold", getScoreColor(result.pronunciation_score))}>
                  {result.pronunciation_score}
                </p>
                <Progress value={result.pronunciation_score} className="mt-2" />
              </div>
              <div className="border-2 border-foreground p-4 text-center">
                <p className="text-sm text-muted-foreground">流利度</p>
                <p className={cn("text-3xl font-bold", getScoreColor(result.fluency_score))}>
                  {result.fluency_score}
                </p>
                <Progress value={result.fluency_score} className="mt-2" />
              </div>
              <div className="border-2 border-foreground p-4 text-center">
                <p className="text-sm text-muted-foreground">完整度</p>
                <p className={cn("text-3xl font-bold", getScoreColor(result.completeness_score))}>
                  {result.completeness_score}
                </p>
                <Progress value={result.completeness_score} className="mt-2" />
              </div>
            </div>

            {/* Feedback */}
            {result.feedback && (
              <div className="border-2 border-foreground p-4">
                <p className="text-sm text-muted-foreground mb-1">专业反馈：</p>
                <p className="text-sm">{result.feedback}</p>
              </div>
            )}

            {/* Word-level scores */}
            {result.words_result && result.words_result.length > 0 && (
              <div className="border-2 border-foreground p-4">
                <p className="text-sm text-muted-foreground mb-2">单词评分：</p>
                <div className="flex flex-wrap gap-2">
                  {result.words_result.map((ws, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "px-3 py-2 text-sm border-2 rounded",
                        getWordBgColor(ws.accuracy_score)
                      )}
                    >
                      <div className="font-medium">{ws.word}</div>
                      <div className="text-xs opacity-80">{ws.accuracy_score}分</div>
                      {ws.error_type && ws.error_type !== 'None' && (
                        <div className="text-xs">{ws.error_type}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Billing info */}
            {result.billed && (
              <p className="text-xs text-muted-foreground text-center">
                已扣除 {result.seconds_used} 秒，剩余 {result.remaining_seconds} 秒
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          {result && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setResult(null);
                setAudioBlob(null);
                setError(null);
              }}
            >
              再练一次
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="flex-1">
            关闭
          </Button>
        </div>
      </div>

      {/* 授权码充值弹窗 */}
      <AuthCodeDialog
        open={showAuthCodeDialog}
        onOpenChange={setShowAuthCodeDialog}
      />

      {/* 麦克风权限引导弹窗 */}
      <MicPermissionGuide
        open={showPermissionGuide}
        onOpenChange={setShowPermissionGuide}
      />
    </div>
  );
};
