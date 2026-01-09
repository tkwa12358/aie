import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { wordsApi } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Download, RefreshCw, Database, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DictionaryInfo {
  id: string;
  name: string;
  description: string;
  wordCount: number;
  available: boolean;
}

interface ImportStatus {
  isImporting: boolean;
  currentDict: string;
  progress: number;
  message: string;
}

const AdminDictionary: React.FC = () => {
  const { toast } = useToast();
  const [dictionaries, setDictionaries] = useState<DictionaryInfo[]>([]);
  const [stats, setStats] = useState({
    totalWords: 0,
    withPhonetic: 0,
    withTranslation: 0,
    withDefinitions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingDicts, setLoadingDicts] = useState(true);
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    isImporting: false,
    currentDict: '',
    progress: 0,
    message: '',
  });

  const fetchDictionaries = async () => {
    setLoadingDicts(true);
    try {
      const data = await wordsApi.getDictionaries();
      setDictionaries(data);
    } catch (error) {
      console.error('Failed to fetch dictionaries:', error);
      toast({
        title: '获取词库列表失败',
        description: '无法获取可用词库列表',
        variant: 'destructive',
      });
    } finally {
      setLoadingDicts(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await wordsApi.getStats();

      setStats({
        totalWords: data.totalWords || 0,
        withPhonetic: data.withPhonetic || 0,
        withTranslation: data.withTranslation || 0,
        withDefinitions: data.withDefinitions || 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast({
        title: '获取统计失败',
        description: '无法获取词库统计信息',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDictionaries();
    fetchStats();
  }, []);

  const importDictionary = async (dictId: string, dictName: string) => {
    setImportStatus({
      isImporting: true,
      currentDict: dictId,
      progress: 10,
      message: `正在导入 ${dictName} 词库...`,
    });

    try {
      const result = await wordsApi.importDictionary(dictId, 'import');

      setImportStatus(prev => ({ ...prev, progress: 100, message: `导入完成! ${result.imported || 0} 个单词` }));

      toast({
        title: '导入成功',
        description: `${dictName} 词库已成功导入 ${result.imported || 0} 个单词`,
      });

      // Refresh stats
      await fetchStats();
    } catch (error: any) {
      console.error('Import failed:', error);
      toast({
        title: '导入失败',
        description: error?.response?.data?.error || error?.message || '导入词库时出错',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => {
        setImportStatus({
          isImporting: false,
          currentDict: '',
          progress: 0,
          message: '',
        });
      }, 2000);
    }
  };

  const importAllDictionaries = async () => {
    setImportStatus({
      isImporting: true,
      currentDict: 'all',
      progress: 5,
      message: '正在导入所有词库...',
    });

    try {
      const result = await wordsApi.importDictionary('all', 'import-all');

      const uniqueWords = result.uniqueWords || result.totalImported || 0;
      const processed = result.totalProcessed || result.totalImported || 0;

      setImportStatus(prev => ({
        ...prev,
        progress: 100,
        message: `导入完成! 数据库共 ${uniqueWords.toLocaleString()} 个唯一单词`
      }));

      toast({
        title: '导入成功',
        description: `处理 ${processed.toLocaleString()} 条记录，去重后共 ${uniqueWords.toLocaleString()} 个唯一单词`,
      });

      await fetchStats();
    } catch (error: any) {
      console.error('Import all failed:', error);
      toast({
        title: '导入失败',
        description: error?.response?.data?.error || error?.message || '导入词库时出错',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => {
        setImportStatus({
          isImporting: false,
          currentDict: '',
          progress: 0,
          message: '',
        });
      }, 2000);
    }
  };

  const totalDictWords = dictionaries.reduce((sum, d) => sum + d.wordCount, 0);
  const availableDicts = dictionaries.filter(d => d.available).length;

  return (
    <AdminLayout>
      <Helmet>
        <title>词库管理 - 管理后台</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">词库管理</h1>
            <p className="text-muted-foreground">管理和导入词库数据</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { fetchStats(); fetchDictionaries(); }} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Button
              onClick={importAllDictionaries}
              disabled={importStatus.isImporting || availableDicts === 0}
            >
              {importStatus.isImporting && importStatus.currentDict === 'all' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              一键导入全部
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>已导入单词</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Database className="h-6 w-6 text-primary" />
                {loading ? '...' : stats.totalWords.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>含音标</CardDescription>
              <CardTitle className="text-3xl">
                {loading ? '...' : stats.withPhonetic.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress
                value={stats.totalWords ? (stats.withPhonetic / stats.totalWords) * 100 : 0}
                className="h-2"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>含中文释义</CardDescription>
              <CardTitle className="text-3xl">
                {loading ? '...' : stats.withTranslation.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress
                value={stats.totalWords ? (stats.withTranslation / stats.totalWords) * 100 : 0}
                className="h-2"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>含英文定义</CardDescription>
              <CardTitle className="text-3xl">
                {loading ? '...' : stats.withDefinitions.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress
                value={stats.totalWords ? (stats.withDefinitions / stats.totalWords) * 100 : 0}
                className="h-2"
              />
            </CardContent>
          </Card>
        </div>

        {/* Import Progress */}
        {importStatus.isImporting && (
          <Card className="border-primary">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {importStatus.message}
                  </span>
                  <span className="text-sm text-muted-foreground">{importStatus.progress}%</span>
                </div>
                <Progress value={importStatus.progress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dictionary List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              可用词库
              <Badge variant="secondary" className="ml-2">
                {loadingDicts ? '...' : `${availableDicts}/${dictionaries.length} 可用`}
              </Badge>
            </CardTitle>
            <CardDescription>
              共 {totalDictWords.toLocaleString()} 个单词，选择需要导入的词库
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDicts ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>词库名称</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead className="text-right">词汇量</TableHead>
                    <TableHead className="text-center">状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dictionaries.map((dict) => (
                    <TableRow key={dict.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {dict.name}
                          <Badge variant="outline" className="text-xs">{dict.id}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{dict.description}</TableCell>
                      <TableCell className="text-right font-mono">
                        {dict.wordCount.toLocaleString()} 词
                      </TableCell>
                      <TableCell className="text-center">
                        {dict.available ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            可用
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            未安装
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={dict.available ? "outline" : "secondary"}
                          onClick={() => importDictionary(dict.id, dict.name)}
                          disabled={importStatus.isImporting || !dict.available}
                        >
                          {importStatus.isImporting && importStatus.currentDict === dict.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-1" />
                          )}
                          导入
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Help Info */}
        <Card>
          <CardHeader>
            <CardTitle>使用说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• 词库文件位于 <code className="bg-muted px-1 rounded">data/dictionary/merged/</code> 目录</p>
            <p>• 点击"一键导入全部"可以导入所有可用词库</p>
            <p>• 也可以单独导入某个词库，已存在的单词会自动更新</p>
            <p>• 导入过程中请勿关闭页面</p>
            <p>• 词库涵盖：小学、初中、高中、四六级、考研、托福、雅思、GRE、GMAT、SAT、BEC、专四专八</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDictionary;
