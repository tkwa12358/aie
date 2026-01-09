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
import { Plus, Trash2, Copy, Check, Loader2, Unlock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authCodesApi, AuthCode } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/admin/AdminLayout';
import { format } from 'date-fns';

const AdminAppCodes: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    count: 1,
    expires_days: 365,
  });

  // 只获取应用类授权码
  const { data: authCodes = [], isLoading } = useQuery({
    queryKey: ['admin-app-codes'],
    queryFn: async () => {
      const allCodes = await authCodesApi.getCodes();
      // 过滤只显示应用类授权码
      return allCodes.filter((code: AuthCode) =>
        code.code_type === 'app_unlock'
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await authCodesApi.generateCodes('app_unlock', data.count, data.expires_days);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-app-codes'] });
      toast({ title: `成功创建 ${formData.count} 个应用授权码` });
      setIsOpen(false);
      setFormData({ count: 1, expires_days: 365 });
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
      queryClient.invalidateQueries({ queryKey: ['admin-app-codes'] });
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

  const usedCount = authCodes.filter((c: AuthCode) => c.is_used).length;
  const unusedCount = authCodes.length - usedCount;

  return (
    <AdminLayout>
      <Helmet>
        <title>应用授权码 - 管理后台</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Unlock className="h-6 w-6" />
              应用授权码
            </h1>
            <p className="text-muted-foreground mt-1">
              用于试用期结束后解锁应用全部功能
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
                <DialogTitle>批量生成应用授权码</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    应用授权码用于解锁应用全部功能，用户在30天试用期结束后需要使用授权码激活。
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
                    onChange={(e) => setFormData({ ...formData, expires_days: parseInt(e.target.value) || 365 })}
                  />
                  <p className="text-xs text-muted-foreground">建议设置较长的有效期（如365天）</p>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  生成应用授权码
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
            <div className="text-2xl font-bold text-green-600">{unusedCount}</div>
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
            暂无应用授权码，点击"批量生成"创建
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>授权码</TableHead>
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

export default AdminAppCodes;
