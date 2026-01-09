import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { devicesApi, DeviceRegistration } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import {
  Smartphone,
  Search,
  RefreshCw,
  Trash2,
  Unlock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const AdminDevices: React.FC = () => {
  const { toast } = useToast();
  const [devices, setDevices] = useState<DeviceRegistration[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await devicesApi.getDevices({
        search: search || undefined,
        limit,
        offset: page * limit,
      });
      setDevices(data.devices);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      toast({
        title: '获取设备列表失败',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [search, page]);

  const handleSearch = () => {
    setPage(0);
    setSearch(searchInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleUnlockDevice = async (fingerprint: string, action: 'delete' | 'increase-limit', newLimit?: number) => {
    try {
      await devicesApi.unlockDevice(fingerprint, action, newLimit);
      toast({
        title: action === 'delete' ? '设备已解锁' : '设备限制已调整',
        description: action === 'delete' ? '该设备的所有注册记录已清除' : `新的注册上限: ${newLimit}`,
      });
      fetchDevices();
    } catch (error: any) {
      toast({
        title: '操作失败',
        description: error?.response?.data?.error || '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await devicesApi.deleteDeviceRegistration(id);
      toast({
        title: '记录已删除',
      });
      fetchDevices();
    } catch (error: any) {
      toast({
        title: '删除失败',
        description: error?.response?.data?.error || '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  // 按设备指纹分组
  const groupedDevices = devices.reduce((acc, device) => {
    if (!acc[device.device_fingerprint]) {
      acc[device.device_fingerprint] = [];
    }
    acc[device.device_fingerprint].push(device);
    return acc;
  }, {} as Record<string, DeviceRegistration[]>);

  const uniqueFingerprints = Object.keys(groupedDevices);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">设备管理</h1>
            <p className="text-muted-foreground">管理设备注册绑定，防止刷注册</p>
          </div>
          <Button variant="outline" onClick={fetchDevices} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {/* 搜索栏 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="搜索用户名、邮箱或账号..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
              </div>
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                搜索
              </Button>
              {search && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                    setPage(0);
                  }}
                >
                  清除
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>设备注册记录</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Smartphone className="h-6 w-6 text-primary" />
                {loading ? '...' : total}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>唯一设备数</CardDescription>
              <CardTitle className="text-3xl">
                {loading ? '...' : uniqueFingerprints.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>默认注册限制</CardDescription>
              <CardTitle className="text-3xl">3 个账号/设备</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* 设备列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              设备注册记录
              {search && (
                <Badge variant="secondary" className="ml-2">
                  搜索: {search}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              每台设备默认最多注册 3 个账号，可手动调整限制或解锁
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search ? '未找到匹配的记录' : '暂无设备注册记录'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>设备指纹</TableHead>
                    <TableHead>注册账号</TableHead>
                    <TableHead>用户名</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead className="text-center">已注册/上限</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-mono text-xs">
                        {device.device_fingerprint}
                      </TableCell>
                      <TableCell>{device.account}</TableCell>
                      <TableCell>
                        {device.display_name || device.email || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(device.created_at).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            device.registrationCount >= device.max_registrations
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {device.registrationCount} / {device.max_registrations}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {/* 解锁设备 */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Unlock className="h-4 w-4 mr-1" />
                                解锁
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>解锁设备</AlertDialogTitle>
                                <AlertDialogDescription>
                                  选择解锁方式：
                                  <br />
                                  <strong>清除记录</strong>: 删除该设备的所有注册记录，设备可重新注册
                                  <br />
                                  <strong>增加限制</strong>: 提高该设备的注册上限
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleUnlockDevice(device.device_fingerprint, 'delete')
                                  }
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  清除所有记录
                                </AlertDialogAction>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleUnlockDevice(
                                      device.device_fingerprint,
                                      'increase-limit',
                                      device.max_registrations + 3
                                    )
                                  }
                                >
                                  增加 3 个名额
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          {/* 删除单条记录 */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>删除记录</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要删除此注册记录吗？删除后该设备可以多注册一个账号。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteRecord(device.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* 分页 */}
            {total > limit && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  上一页
                </Button>
                <span className="flex items-center px-4 text-sm text-muted-foreground">
                  第 {page + 1} / {Math.ceil(total / limit)} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(page + 1) * limit >= total}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              使用说明
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. 每台设备默认最多可以注册 3 个账号</p>
            <p>2. 设备指纹基于浏览器特征生成，换浏览器或清除数据可能产生新指纹</p>
            <p>3. <strong>解锁 - 清除记录</strong>: 删除该设备所有注册记录，设备可重新注册</p>
            <p>4. <strong>解锁 - 增加名额</strong>: 保留现有记录，但提高注册上限</p>
            <p>5. <strong>删除单条记录</strong>: 仅删除一条注册记录，释放一个注册名额</p>
            <p>6. 搜索支持按用户名、邮箱、注册账号模糊匹配</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDevices;
