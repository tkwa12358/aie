import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Copy, Check, Loader2, Timer } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authCodesApi, AuthCode } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/admin/AdminLayout';
import { format } from 'date-fns';

const AdminAuthCodes: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code_type: 'pro_30min',
    count: 1,
    expires_days: 90,
  });

  // 只获取评测类授权码
  const { data: authCodes = [], isLoading } = useQuery({
    queryKey: ['admin-pro-codes'],
    queryFn: async () => {
      const allCodes = await authCodesApi.getCodes();
      // 过滤只显示专业评测类授权码
      return allCodes.filter((code: AuthCode) =>
        code.code_type.startsWith('pro_')
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await authCodesApi.generateCodes(data.code_type, data.count, data.expires_days);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pro-codes'] });
      toast({ title: `成功创建 ${formData.count} 个评测授权码` });
      setIsOpen(false);
      setFormData({ code_type: 'pro_30min', count: 1, expires_days: 90 });
    },
    onError: (error: any) => {
      toast({ title: '创建失败', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await authCodesApi.deleteCode(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pro-codes'] });
      toast({ title: '授权码删除成功' });
    },
    onError: (error: any) => {
      toast({ title: '删除失败', description: error.message, variant: 'destructive' });
    },
  });

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: '已复制到剪贴板' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getCodeTypeLabel = (codeType: string) => {
    switch (codeType) {
      case 'pro_10min': return '10分钟';
      case 'pro_30min': return '30分钟';
      case 'pro_60min': return '60分钟';
      default: return codeType;
    }
  };

  const usedCount = authCodes.filter((c: AuthCode) => c.is_used).length;
  const unusedCount = authCodes.length - usedCount;

  return (
    <AdminLayout>
      <Helmet>
        <title>评测授权码 - 管理后台</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Timer className="h-6 w-6" />
              评测授权码
            </h1>
            <p className="text-muted-foreground mt-1">
              用于充值专业语音评测时长
            </p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                批量生成
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>批量生成评测授权码</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code_type">评测时长</Label>
                  <Select
                    value={formData.code_type}
                    onValueChange={(value) => setFormData({ ...formData, code_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pro_10min">10分钟</SelectItem>
                      <SelectItem value="pro_30min">30分钟（推荐）</SelectItem>
                      <SelectItem value="pro_60min">60分钟</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    用户兑换后将增加对应的专业评测时长
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="count">生成数量</Label>
                  <Input
                    id="count"
                    type="number"
                    min={1}
                    max={100}
                    value={formData.count}
                    onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expires_days">有效期(天)</Label>
                  <Input
                    id="expires_days"
                    type="number"
                    min={1}
                    value={formData.expires_days}
                    onChange={(e) => setFormData({ ...formData, expires_days: parseInt(e.target.value) || 90 })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  生成评测授权码
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold">{authCodes.length}</div>
            <div className="text-sm text-muted-foreground">总数</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{unusedCount}</div>
            <div className="text-sm text-muted-foreground">未使用</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold text-gray-400">{usedCount}</div>
            <div className="text-sm text-muted-foreground">已使用</div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : authCodes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            暂无评测授权码，点击"批量生成"创建
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>授权码</TableHead>
                <TableHead>时长</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>使用者</TableHead>
                <TableHead>使用时间</TableHead>
                <TableHead>过期时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {authCodes.map((code: AuthCode) => (
                <TableRow key={code.id}>
                  <TableCell className="font-mono">{code.code}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      {getCodeTypeLabel(code.code_type)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${code.is_used
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}
                    >
                      {code.is_used ? '已使用' : '未使用'}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {code.used_by || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {code.used_at
                      ? format(new Date(code.used_at), 'yyyy-MM-dd HH:mm')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {code.expires_at
                      ? format(new Date(code.expires_at), 'yyyy-MM-dd')
                      : '永久'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(code.code, code.id)}
                      >
                        {copiedId === code.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      {!code.is_used && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(code.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAuthCodes;
