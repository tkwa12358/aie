import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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

interface PhonemeScore {
  phoneme: string;
  accuracy_score: number;
  is_correct: boolean;
  error_type?: 'missing' | 'extra' | 'mispronounced' | 'replaced';
}

interface WordScore {
  word: string;
  accuracy_score: number;
  fluency_score?: number;
  error_type?: string;
  phonemes?: PhonemeScore[];
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const recordedBuffersRef = useRef<Float32Array[]>([]);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingModeRef = useRef<'media-recorder' | 'webaudio' | null>(null);
  const sampleRateRef = useRef<number>(44100);
  const practiceStartTimeRef = useRef<number>(Date.now());
  const audioSessionTypeRef = useRef<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

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

  // 获取专业评测剩余时间（数据库存秒，展示按分钟）
  const professionalSeconds = (profile as { professional_voice_minutes?: number })?.professional_voice_minutes || 0;
  const professionalMinutes = professionalSeconds / 60;

  const mergeBuffers = (buffers: Float32Array[]) => {
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    buffers.forEach((buffer) => {
      result.set(buffer, offset);
      offset += buffer.length;
    });
    return result;
  };

  const mixToMono = (buffer: AudioBuffer) => {
    const channels = buffer.numberOfChannels;
    if (channels === 1) {
      return buffer.getChannelData(0);
    }

    const length = buffer.length;
    const mixed = new Float32Array(length);
    for (let channel = 0; channel < channels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        mixed[i] += data[i];
      }
    }
    for (let i = 0; i < length; i += 1) {
      mixed[i] /= channels;
    }
    return mixed;
  };

  const encodeWav = (samples: Float32Array, sampleRate: number) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i += 1) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i += 1) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const isSilent = (samples: Float32Array, threshold = 0.0001) => {
    if (!samples.length) return true;
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const value = samples[i];
      sum += value * value;
    }
    return sum / samples.length < threshold;
  };

  const isIosSafari = () => {
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
    return isIos && isSafari;
  };

  const getRecorderMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return undefined;
    if (typeof MediaRecorder.isTypeSupported !== 'function') return undefined;

    const candidates = [
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ];

    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return undefined;
  };

  const decodeToWav = async (blob: Blob) => {
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;

    const context = new AudioContextConstructor();
    try {
      const buffer = await blob.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(buffer.slice(0));
      const monoSamples = mixToMono(audioBuffer);
      if (isSilent(monoSamples)) {
        return null;
      }
      return encodeWav(monoSamples, audioBuffer.sampleRate);
    } finally {
      await context.close();
    }
  };

  const setAudioSessionType = (type: string | null) => {
    const audioSession = (navigator as Navigator & { audioSession?: { type?: string } }).audioSession;
    if (!audioSession) return;

    try {
      if (audioSessionTypeRef.current === null && audioSession.type) {
        audioSessionTypeRef.current = audioSession.type;
      }
      if (type) {
        audioSession.type = type;
      } else if (audioSessionTypeRef.current) {
        audioSession.type = audioSessionTypeRef.current;
      }
    } catch {
      // Ignore AudioSession errors on unsupported platforms.
    }
  };

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

    let localAudioContext: AudioContext | null = null;

    try {
      setError(null);
      audioPlayerRef.current?.pause();
      audioPlayerRef.current = null;
      recordingModeRef.current = null;
      recordedChunksRef.current = [];

      setAudioSessionType('play-and-record');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      // 检查音轨状态
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0 || !audioTracks[0].enabled) {
        setError('未检测到可用的麦克风');
        return;
      }
      audioTracks.forEach(track => {
        track.enabled = true;
      });

      mediaStreamRef.current = stream;

      const recorderMimeType = getRecorderMimeType();
      const canUseMediaRecorder = typeof MediaRecorder !== 'undefined' && isIosSafari();
      let mediaRecorderStarted = false;

      if (canUseMediaRecorder) {
        try {
          const recorder = new MediaRecorder(stream, recorderMimeType ? { mimeType: recorderMimeType } : undefined);
          recordedChunksRef.current = [];
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          };
          recorder.onstop = () => {
            mediaRecorderRef.current = null;
          };
          recorder.start();
          mediaRecorderRef.current = recorder;
          recordingModeRef.current = 'media-recorder';
          mediaRecorderStarted = true;
        } catch (err) {
          console.warn('MediaRecorder start failed, fallback to WebAudio:', err);
        }
      }

      if (mediaRecorderStarted) {
        setIsRecording(true);
        return;
      }

      const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) {
        setError('当前浏览器不支持录音功能，请使用 Safari 或 Chrome');
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        setAudioSessionType(null);
        return;
      }

      const createdAudioContext = new AudioContextConstructor();
      localAudioContext = createdAudioContext;
      const resumePromise = createdAudioContext.resume();

      sampleRateRef.current = createdAudioContext.sampleRate;
      recordedBuffersRef.current = [];

      const sourceNode = createdAudioContext.createMediaStreamSource(stream);
      const processor = createdAudioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        recordedBuffersRef.current.push(new Float32Array(input));
        const output = event.outputBuffer.getChannelData(0);
        output.fill(0);
      };

      sourceNode.connect(processor);
      processor.connect(createdAudioContext.destination);

      await resumePromise;

      audioContextRef.current = createdAudioContext;
      sourceNodeRef.current = sourceNode;
      processorRef.current = processor;
      recordingModeRef.current = 'webaudio';

      setIsRecording(true);
    } catch (err: unknown) {
      if (localAudioContext) {
        try {
          await localAudioContext.close();
        } catch {
          // ignore cleanup failures
        }
      }
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      setAudioSessionType(null);
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

  const stopRecording = async () => {
    if (!isRecording) return;

    setIsRecording(false);

    if (recordingModeRef.current === 'media-recorder' && mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.stop();
      await stopped;
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      setAudioSessionType(null);
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;

      const recordedBlob = new Blob(recordedChunksRef.current, {
        type: recorder.mimeType || 'audio/webm'
      });
      recordedChunksRef.current = [];

      if (!recordedBlob.size) {
        setAudioBlob(null);
        setError('未录到声音，请检查麦克风权限后重试');
        return;
      }

      let wavBlob: Blob | null = null;
      try {
        wavBlob = recordedBlob.type === 'audio/wav' ? recordedBlob : await decodeToWav(recordedBlob);
      } catch (err) {
        console.error('Decode recording failed:', err);
      }
      if (!wavBlob || !wavBlob.size) {
        setAudioBlob(null);
        setError('录音数据无效，请重新录音');
        return;
      }

      setAudioBlob(wavBlob);
      recordingModeRef.current = null;
      return;
    }

    processorRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;

    if (audioContextRef.current) {
      await audioContextRef.current.close();
    }
    audioContextRef.current = null;
    sourceNodeRef.current = null;
    processorRef.current = null;
    setAudioSessionType(null);

    const merged = mergeBuffers(recordedBuffersRef.current);
    if (!merged.length || isSilent(merged)) {
      setAudioBlob(null);
      setError('未录到声音，请检查麦克风权限后重试');
      return;
    }

    const wavBlob = encodeWav(merged, sampleRateRef.current);
    if (!wavBlob.size) {
      setAudioBlob(null);
      setError('录音数据无效，请重新录音');
      return;
    }

    setAudioBlob(wavBlob);
    recordingModeRef.current = null;
  };

  const submitForAssessment = async () => {
    if (!audioBlob || !audioBlob.size) {
      setError('未录到声音，请检查麦克风权限后重试');
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
                description: `总分: ${data.overall_score}分，已扣除${(data.seconds_used / 60).toFixed(1)}分钟`,
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
      audioPlayerRef.current?.pause();
      audioPlayerRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
      };
      audio.play();
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
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
              专业评测剩余: {professionalMinutes.toFixed(1)}分钟
            </p>
          </div>
        )}

        {/* Results */}
        {result && (() => {
          // 过滤出问题单词（accuracy_score < 85）
          const problemWords = (result.words_result || []).filter(w => w.accuracy_score < 85);

          return (
            <div className="space-y-4 mb-6">
              {/* 精简头部：总分 + 错误词数 */}
              <div className="flex items-center gap-4 border-2 border-primary p-3 bg-primary/5">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">总分</p>
                  <p className={cn("text-3xl font-bold", getScoreColor(result.overall_score))}>
                    {result.overall_score}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">问题单词</p>
                  <p className={cn("text-xl font-bold", problemWords.length > 0 ? 'text-red-600' : 'text-green-600')}>
                    {problemWords.length} 个
                  </p>
                </div>
              </div>

              {/* 问题单词及音素详情 */}
              {problemWords.length > 0 && (
                <div className="border-2 border-foreground p-3">
                  <p className="text-sm text-muted-foreground mb-2">需要改进的单词：</p>
                  <div className="space-y-2">
                    {problemWords.map((ws, idx) => (
                      <div
                        key={idx}
                        className="border border-red-300 bg-red-50 rounded p-2"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-red-800">"{ws.word}"</span>
                          <span className="text-sm text-red-600">{ws.accuracy_score}分</span>
                        </div>
                        {/* 音素详情 */}
                        {ws.phonemes && ws.phonemes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-xs text-muted-foreground mr-1">音素:</span>
                            {ws.phonemes.map((p, pIdx) => (
                              <span
                                key={pIdx}
                                className={cn(
                                  "text-xs px-1.5 py-0.5 rounded border",
                                  p.is_correct
                                    ? "bg-green-100 border-green-400 text-green-700"
                                    : "bg-red-100 border-red-400 text-red-700 font-medium"
                                )}
                                title={`${p.phoneme}: ${p.accuracy_score}分${p.error_type ? ` (${p.error_type})` : ''}`}
                              >
                                [{p.phoneme}]{p.is_correct ? '✓' : '✗'}
                              </span>
                            ))}
                          </div>
                        )}
                        {ws.error_type && ws.error_type !== 'None' && (
                          <p className="text-xs text-red-500 mt-1">{ws.error_type}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 所有单词都正确时的提示 */}
              {problemWords.length === 0 && result.words_result && result.words_result.length > 0 && (
                <div className="border-2 border-green-500 bg-green-50 p-3 text-center">
                  <p className="text-green-700 font-medium">所有单词发音都很棒！</p>
                </div>
              )}

              {/* Feedback */}
              {result.feedback && (
                <div className="border border-foreground/30 p-2 text-sm">
                  <span className="text-muted-foreground">反馈：</span>
                  <span>{result.feedback}</span>
                </div>
              )}

              {/* Billing info */}
              {result.billed && (
                <p className="text-xs text-muted-foreground text-center">
                  已扣除 {(result.seconds_used / 60).toFixed(1)} 分钟，剩余 {(result.remaining_seconds / 60).toFixed(1)} 分钟
                </p>
              )}
            </div>
          );
        })()}

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
