import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { wordsApi, WordBookEntry } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Helmet } from 'react-helmet-async';
import { Loader2, Volume2, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const WordBook = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [words, setWords] = useState<WordBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) fetchWords();
  }, [user]);

  const fetchWords = async () => {
    try {
      const data = await wordsApi.getWords();
      setWords(data as WordBookEntry[]);
    } catch (error) {
      console.error('获取单词失败:', error);
      toast({ title: '获取单词失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const deleteWord = async (id: string) => {
    try {
      await wordsApi.deleteWord(id);
      setWords(words.filter(w => w.id !== id));
      toast({ title: '已删除' });
    } catch (error) {
      toast({ title: '删除失败', variant: 'destructive' });
    }
  };

  const playWord = (word: string) => {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
  };

  const filteredWords = words.filter(w =>
    w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.translation?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Helmet>
        <title>单词本 - AI English Club</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">单词本</h1>
            <span className="text-muted-foreground">{words.length} 个单词</span>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="搜索单词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-2 border-foreground"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : filteredWords.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              {searchQuery ? '未找到匹配的单词' : '单词本为空，点击视频中的单词添加'}
            </p>
          ) : (
            <div className="grid gap-3">
              {filteredWords.map(word => (
                <div key={word.id} className="border-2 border-foreground p-4 bg-card flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold">{word.word}</span>
                      {word.phonetic && (
                        <span className="text-sm text-muted-foreground font-mono">{word.phonetic}</span>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => playWord(word.word)}>
                        <Volume2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {word.translation && <p className="text-sm">{word.translation}</p>}
                    {/* context 例句已移除 - 用户要求不显示项目中的句子 */}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteWord(word.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default WordBook;
