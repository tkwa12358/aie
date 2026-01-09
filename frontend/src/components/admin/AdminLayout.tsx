import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Video,
  Tag,
  Users,
  ArrowLeft,
  BookOpen,
  Crown,
  Languages,
  Smartphone,
  Unlock,
  Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/admin', label: '仪表盘', icon: LayoutDashboard },
  { path: '/admin/videos', label: '视频管理', icon: Video },
  { path: '/admin/categories', label: '分类管理', icon: Tag },
  { path: '/admin/users', label: '用户管理', icon: Users },
  { path: '/admin/devices', label: '设备管理', icon: Smartphone },
  { path: '/admin/app-codes', label: '应用授权码', icon: Unlock },
  { path: '/admin/pro-codes', label: '评测授权码', icon: Timer },
  { path: '/admin/professional', label: '专业评测', icon: Crown },
  { path: '/admin/dictionary', label: '词库管理', icon: BookOpen },
  { path: '/admin/translation', label: '翻译配置', icon: Languages },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回网站
          </Button>
          <h1 className="font-semibold">AI English Club 管理后台</h1>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-muted/40 min-h-[calc(100vh-3.5rem)]">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start',
                    location.pathname === item.path && 'bg-muted'
                  )}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;