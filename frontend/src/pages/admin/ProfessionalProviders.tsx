import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Plus, Pencil, Trash2, Crown, Star } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assessmentApi, AssessmentProvider } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PROVIDER_TYPES = [
  { value: 'azure', label: '微软 Azure Speech', description: '专业发音评测，支持音素级评分' },
  { value: 'tencent_soe', label: '腾讯 SOE 智能评测', description: '智能口语评测，适合中英文' },
  { value: 'ifly', label: '讯飞语音评测', description: '国内领先的语音评测' },
];

const AdminProfessionalProviders: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AssessmentProvider | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    provider_type: 'azure',
    api_endpoint: '',
    api_key: '',
    api_secret: '',
    region: '',
    is_active: true,
    is_default: false,
    priority: 0,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['admin-professional-providers'],
    queryFn: async () => {
      const data = await assessmentApi.getProviders();
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const configJson: { api_key?: string; api_secret?: string } = {};
      if (data.api_key) configJson.api_key = data.api_key;
      if (data.api_secret) configJson.api_secret = data.api_secret;

      await assessmentApi.createProvider({
        name: data.name,
        providerType: data.provider_type,
        apiEndpoint: data.api_endpoint,
        region: data.region || undefined,
        isDefault: data.is_default,
        priority: data.priority,
        configJson: configJson,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-professional-providers'] });
      toast({ title: '服务商配置创建成功' });
      setIsOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: '创建失败', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const configJson: { api_key?: string; api_secret?: string } = {};
      if (data.api_key) configJson.api_key = data.api_key;
      if (data.api_secret) configJson.api_secret = data.api_secret;

      await assessmentApi.updateProvider(id, {
        name: data.name,
        providerType: data.provider_type,
        apiEndpoint: data.api_endpoint,
        region: data.region || undefined,
        isActive: data.is_active,
        isDefault: data.is_default,
        priority: data.priority,
        ...(Object.keys(configJson).length > 0 ? { configJson } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-professional-providers'] });
      toast({ title: '服务商配置更新成功' });
      setIsOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: '更新失败', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await assessmentApi.deleteProvider(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-professional-providers'] });
      toast({ title: '服务商配置删除成功' });
    },
    onError: (error: any) => {
      toast({ title: '删除失败', description: error.message, variant: 'destructive' });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await assessmentApi.setDefaultProvider(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-professional-providers'] });
      toast({ title: '已设为默认服务商' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      provider_type: 'azure',
      api_endpoint: '',
      api_key: '',
      api_secret: '',
      region: '',
      is_active: true,
      is_default: false,
      priority: 0,
    });
    setEditingProvider(null);
  };

  const handleEdit = (provider: AssessmentProvider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      provider_type: provider.provider_type,
      api_endpoint: provider.api_endpoint || '',
      api_key: '',
      api_secret: '',
      region: provider.region || '',
      is_active: provider.is_active,
      is_default: provider.is_default,
      priority: provider.priority || 0,
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProvider) {
      updateMutation.mutate({ id: editingProvider.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getProviderDefaults = (type: string) => {
    switch (type) {
      case 'azure':
        return {
          api_endpoint: 'https://{region}.stt.speech.microsoft.com',
          api_key_secret_name: 'AZURE_SPEECH_KEY',
          region: 'eastasia',
        };
      case 'tencent_soe':
        return {
          api_endpoint: 'https://soe.tencentcloudapi.com',
          api_key_secret_name: 'TENCENT_SOE_SECRET_ID',
          api_secret_key_name: 'TENCENT_SOE_SECRET_KEY',
          region: 'ap-guangzhou',
        };
      case 'ifly':
        return {
          api_endpoint: 'https://api.xfyun.cn',
          api_key_secret_name: 'IFLY_APP_ID',
          api_secret_key_name: 'IFLY_API_KEY',
          region: '',
        };
      default:
        return {};
    }
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>专业评测服务商 - 管理后台</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">专业评测服务商配置</h1>
          </div>
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                添加服务商
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProvider ? '编辑服务商' : '添加服务商'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">服务商名称</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如: Azure 英语评测"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider_type">服务类型</Label>
                  <Select
                    value={formData.provider_type}
                    onValueChange={(value) => {
                      const defaults = getProviderDefaults(value);
                      setFormData({
                        ...formData,
                        provider_type: value,
                        ...defaults,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_TYPES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          <div>
                            <div>{p.label}</div>
                            <div className="text-xs text-muted-foreground">{p.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api_endpoint">API 端点</Label>
                  <Input
                    id="api_endpoint"
                    value={formData.api_endpoint}
                    onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">区域 (Region)</Label>
                  <Input
                    id="region"
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    placeholder="例如: eastasia, ap-guangzhou"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.provider_type === 'azure' && '推荐: eastasia (东亚), southeastasia (东南亚)'}
                    {formData.provider_type === 'tencent_soe' && '推荐: ap-guangzhou, ap-shanghai, ap-beijing'}
                    {formData.provider_type === 'ifly' && '讯飞无需配置区域'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api_key">
                    {formData.provider_type === 'azure' && 'Azure 订阅密钥 (Subscription Key)'}
                    {formData.provider_type === 'tencent_soe' && '腾讯云 SecretId'}
                    {formData.provider_type === 'ifly' && '讯飞 AppId'}
                  </Label>
                  <Input
                    id="api_key"
                    type="password"
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    placeholder={editingProvider ? '留空表示不修改' : '请输入 API 密钥'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.provider_type === 'azure' && '在 Azure Portal → Speech Services → Keys 获取'}
                    {formData.provider_type === 'tencent_soe' && '在腾讯云控制台 → 访问管理 → API密钥管理 获取'}
                    {formData.provider_type === 'ifly' && '在讯飞开放平台 → 控制台 → 应用管理 获取'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api_secret">
                    {formData.provider_type === 'azure' && '(Azure 只需一个密钥，此项留空)'}
                    {formData.provider_type === 'tencent_soe' && '腾讯云 SecretKey'}
                    {formData.provider_type === 'ifly' && '讯飞 APIKey'}
                  </Label>
                  <Input
                    id="api_secret"
                    type="password"
                    value={formData.api_secret}
                    onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                    placeholder={
                      formData.provider_type === 'azure' ? '' :
                        editingProvider ? '留空表示不修改' : '请输入 API Secret'
                    }
                    disabled={formData.provider_type === 'azure'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.provider_type === 'tencent_soe' && '与 SecretId 一起在腾讯云 API密钥管理 获取'}
                    {formData.provider_type === 'ifly' && '在讯飞开放平台应用详情页获取'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">优先级</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">启用</Label>
                </div>
                <Button type="submit" className="w-full">
                  {editingProvider ? '保存' : '创建'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>配置说明</CardTitle>
            <CardDescription>
              在添加服务商时直接输入 API 密钥，密钥将安全存储并仅供评测服务使用。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="border-2 border-border p-4">
                <h4 className="font-bold mb-2">微软 Azure</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• 获取位置: Azure Portal → Speech Services → Keys</li>
                  <li>• 推荐区域: eastasia</li>
                  <li>• 支持音素级评分</li>
                </ul>
              </div>
              <div className="border-2 border-border p-4">
                <h4 className="font-bold mb-2">腾讯 SOE</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• 获取位置: 腾讯云 → API密钥管理</li>
                  <li>• 需要 SecretId 和 SecretKey</li>
                  <li>• 推荐区域: ap-guangzhou</li>
                </ul>
              </div>
              <div className="border-2 border-border p-4">
                <h4 className="font-bold mb-2">讯飞评测</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• 获取位置: 讯飞开放平台 → 应用管理</li>
                  <li>• 需要 AppId 和 APIKey</li>
                  <li>• 暂不支持</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>区域</TableHead>
              <TableHead>优先级</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>默认</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((provider) => (
              <TableRow key={provider.id}>
                <TableCell className="font-medium">{provider.name}</TableCell>
                <TableCell>
                  {PROVIDER_TYPES.find((p) => p.value === provider.provider_type)?.label || provider.provider_type}
                </TableCell>
                <TableCell>{provider.region || '-'}</TableCell>
                <TableCell>{provider.priority}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${provider.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-muted text-muted-foreground'
                      }`}
                  >
                    {provider.is_active ? '启用' : '禁用'}
                  </span>
                </TableCell>
                <TableCell>
                  {provider.is_default ? (
                    <Star className="h-4 w-4 text-primary fill-primary" />
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDefaultMutation.mutate(provider.id)}
                    >
                      设为默认
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(provider)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(provider.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default AdminProfessionalProviders;
