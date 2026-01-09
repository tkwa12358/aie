import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Volume2, BookPlus, X } from 'lucide-react';
import { wordsApi, learningApi } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { lookupWord } from '@/lib/wordCache';

interface WordLookupProps {
  word: string;
  context: string;
  contextTranslation?: string;
  onClose: () => void;
}

interface WordInfo {
  word: string;
  phonetic: string;
  translation: string;
  definitions: { partOfSpeech: string; definition: string; example?: string }[];
}

export const WordLookup = ({ word, context, contextTranslation, onClose }: WordLookupProps) => {
  const [loading, setLoading] = useState(true);
  const [wordInfo, setWordInfo] = useState<WordInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    console.log('WordLookup: Looking up word:', word);
    const fetchWordInfo = async () => {
      try {
        const result = await lookupWord(word);
        if (result) {
          setWordInfo({
            word: result.word,
            phonetic: result.phonetic,
            translation: result.translation,
            definitions: result.definitions,
          });
        } else {
          setWordInfo({
            word,
            phonetic: '',
            translation: '加载失败',
            definitions: [],
          });
        }
      } catch (error) {
        console.error('Error fetching word info:', error);
        setWordInfo({
          word,
          phonetic: '',
          translation: '加载失败',
          definitions: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWordInfo();
  }, [word]);

  const playPronunciation = () => {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
  };

  const addToWordbook = async () => {
    if (!user || !wordInfo) return;

    setSaving(true);
    try {
      await wordsApi.addWord({
        word: wordInfo.word,
        phonetic: wordInfo.phonetic,
        translation: wordInfo.translation,
        context: '', // 用户要求不保存例句
      });

      // 更新用户统计 - 新增生词
      try {
        await learningApi.updateStatistics({ wordsLearned: 1 } as any);
      } catch (statsError) {
        console.error('Failed to update word statistics:', statsError);
      }

      toast({
        title: '已添加到单词本',
        description: `${wordInfo.word} ${wordInfo.phonetic ? `[${wordInfo.phonetic}]` : ''}`,
      });
      onClose();
    } catch (error) {
      console.error('Error saving word:', error);
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: '请稍后重试',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-md border-4 border-foreground bg-card p-6 shadow-lg animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{word}</h2>
            <Button variant="ghost" size="icon" onClick={playPronunciation}>
              <Volume2 className="w-5 h-5" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-2 text-muted-foreground">正在查询...</span>
          </div>
        ) : wordInfo ? (
          <div className="space-y-4">
            {wordInfo.phonetic && (
              <p className="text-muted-foreground font-mono">[{wordInfo.phonetic}]</p>
            )}

            {wordInfo.translation && (
              <div className="border-2 border-foreground p-3 bg-accent rounded-md">
                <p className="font-medium text-lg">{wordInfo.translation}</p>
              </div>
            )}

            {wordInfo.definitions && Array.isArray(wordInfo.definitions) && wordInfo.definitions.length > 0 && (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {wordInfo.definitions.map((def, idx) => {
                  // Defensive check
                  if (!def) return null;

                  // Helper to safely render content
                  const safeRender = (val: any) => {
                    if (typeof val === 'string' || typeof val === 'number') return val;
                    if (typeof val === 'object') return JSON.stringify(val);
                    return '';
                  };

                  return (
                    <div key={idx} className="text-sm border-b border-border/50 last:border-0 pb-2 last:pb-0">
                      {safeRender(def.partOfSpeech) !== 'unknown' && (
                        <span className="text-muted-foreground italic font-semibold mr-2">{safeRender(def.partOfSpeech)}</span>
                      )}
                      <span className="text-foreground/90">{safeRender(def.definition)}</span>
                      {def.example && (
                        <p className="text-xs text-muted-foreground mt-1 ml-2 pl-2 border-l-2 border-primary/30">
                          {safeRender(def.example)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 上下文参考已移除 - 仅显示词库或API返回的内容 */}

            <Button
              className="w-full mt-4"
              onClick={addToWordbook}
              disabled={saving || !user}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <BookPlus className="w-4 h-4 mr-2" />
              )}
              {user ? '添加到单词本' : '登录后添加'}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">未找到单词信息</p>
        )}
      </div>
    </div>
  );
};
