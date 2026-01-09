import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Subtitle } from '@/lib/api-client';
import { Play, Mic, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubtitleListProps {
  subtitles: Subtitle[];
  subtitlesCn?: Subtitle[];
  currentSubtitle: Subtitle | null;
  onSubtitleClick: (subtitle: Subtitle) => void;
  onPractice: (subtitle: Subtitle) => void;
  onAddWord: (word: string, context: string, contextTranslation: string) => void;
  showTranslation?: boolean;
  completedSentences?: number[];
}

export const SubtitleList = ({
  subtitles,
  subtitlesCn,
  currentSubtitle,
  onSubtitleClick,
  onPractice,
  onAddWord,
  showTranslation = true,
  completedSentences = []
}: SubtitleListProps) => {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      // 使用容器内滚动，而非页面滚动（修复移动端问题）
      const container = activeRef.current.closest('[data-radix-scroll-area-viewport]');
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = activeRef.current.getBoundingClientRect();
        const scrollTop = elementRect.top - containerRect.top + container.scrollTop - containerRect.height / 2 + elementRect.height / 2;
        container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
      }
    }
  }, [currentSubtitle]);

  const getTranslation = (subtitle: Subtitle) => {
    if (!subtitlesCn) return null;
    return subtitlesCn.find(s => Math.abs(s.start - subtitle.start) < 0.5);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleWordClick = (word: string, context: string, contextTranslation: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanWord = word.replace(/[^a-zA-Z'-]/g, '');
    if (cleanWord) {
      onAddWord(cleanWord, context, contextTranslation);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        {subtitles.map((subtitle, index) => {
          const isActive = currentSubtitle?.id === subtitle.id;
          const translation = getTranslation(subtitle);
          const isCompleted = completedSentences.includes(index);

          return (
            <div
              key={subtitle.id}
              ref={isActive ? activeRef : null}
              className={cn(
                "p-3 rounded-xl transition-all cursor-pointer border-l-4",
                isActive
                  ? "bg-primary/10 border-l-primary shadow-sm"
                  : isCompleted
                    ? "bg-primary/5 border-l-primary/50"
                    : "bg-card/50 border-l-transparent hover:bg-accent/30"
              )}
              onClick={() => onSubtitleClick(subtitle)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                      {formatTime(subtitle.start)}
                    </span>
                    {isCompleted && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    )}
                  </div>
                  <p className="text-sm md:text-base leading-relaxed">
                    {subtitle.text.split(' ').map((word, idx) => (
                      <span
                        key={idx}
                        className="hover:bg-primary/20 hover:text-primary px-0.5 rounded cursor-pointer transition-colors"
                        onClick={(e) => handleWordClick(word, subtitle.text, translation?.text || '', e)}
                      >
                        {word}{' '}
                      </span>
                    ))}
                  </p>
                  {showTranslation && translation && (
                    <p className="text-xs md:text-sm text-muted-foreground mt-1.5">
                      {translation.text}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  {/* 播放按钮 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 rounded-lg hover:bg-primary/10 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSubtitleClick(subtitle);
                    }}
                    title="播放 Play"
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    <span className="hidden sm:inline">播放</span>
                  </Button>
                  {/* 跟读练习按钮 */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 rounded-lg hover:bg-accent/50 text-xs border-primary/30 hover:border-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPractice(subtitle);
                    }}
                    title="跟读练习 Practice"
                  >
                    <Mic className="w-3.5 h-3.5 mr-1 text-primary" />
                    <span className="hidden sm:inline">跟读</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};