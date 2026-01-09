import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Video, Tag, Key, Clock, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-client';
import AdminLayout from '@/components/admin/AdminLayout';

const AdminDashboard: React.FC = () => {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const data = await adminApi.getDashboard();
      return {
        users: data.totalUsers || 0,
        videos: data.totalVideos || 0,
        categories: data.totalCategories || 0,
        unusedCodes: data.unusedCodes || 0,
      };
    },
  });

  const statCards = [
    { title: '用户总数', value: stats?.users || 0, icon: Users, color: 'text-primary' },
    { title: '视频数量', value: stats?.videos || 0, icon: Video, color: 'text-green-500' },
    { title: '分类数量', value: stats?.categories || 0, icon: Tag, color: 'text-blue-500' },
    { title: '未使用授权码', value: stats?.unusedCodes || 0, icon: Key, color: 'text-orange-500' },
  ];

  return (
    <AdminLayout>
      <Helmet>
        <title>管理后台 - AI English Club</title>
      </Helmet>

      <div className="space-y-6">
        <h1 className="text-2xl font-bold">仪表盘</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                最近活动
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">暂无最近活动记录</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                使用趋势
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">暂无趋势数据</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
