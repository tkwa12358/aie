import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Settings, LogOut, Menu, X, Crown, BarChart3, User, Ticket } from 'lucide-react';
import { useState } from 'react';
import { AuthCodeDialog } from '@/components/AuthCodeDialog';

export const Header = () => {
  const { user, profile, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 获取专业评测时间（数据库直接存储秒数）
  const professionalSeconds = (profile as { professional_voice_minutes?: number })?.professional_voice_minutes || 0;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // 点击视频学习按钮时，清除 lastVideoId 并导航到视频列表
  const handleVideoLearnClick = (e: React.MouseEvent) => {
    e.preventDefault();
    localStorage.removeItem('lastVideoId');
    navigate('/learn');
  };

  return (
    <header className="glass sticky top-0 z-50 border-b border-border/30">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-md">
            <span className="text-primary-foreground font-bold text-xl">AI</span>
          </div>
          <span className="font-semibold text-xl hidden sm:block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            English Club
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" className="rounded-xl hover:bg-accent/50" onClick={handleVideoLearnClick}>
                视频学习
              </Button>
              <Link to="/wordbook">
                <Button variant="ghost" className="rounded-xl hover:bg-accent/50">
                  <BookOpen className="w-4 h-4 mr-2" />
                  单词本
                </Button>
              </Link>
              <Link to="/statistics">
                <Button variant="ghost" className="rounded-xl hover:bg-accent/50">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  学习统计
                </Button>
              </Link>
              <Link to="/local-learn">
                <Button variant="ghost" className="rounded-xl hover:bg-accent/50">本地学习</Button>
              </Link>
              <AuthCodeDialog />
              <Link to="/profile">
                <div className="flex items-center gap-2 px-3 py-1.5 glass rounded-xl cursor-pointer hover:bg-accent/50 transition-colors">
                  <Crown className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">{professionalSeconds}秒</span>
                  <User className="w-3 h-3 text-muted-foreground" />
                </div>
              </Link>
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="outline" className="rounded-xl border-primary/30">
                    <Settings className="w-4 h-4 mr-2" />
                    管理后台
                  </Button>
                </Link>
              )}
              <Button variant="ghost" onClick={handleSignOut} className="rounded-xl hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                退出
              </Button>
            </>
          ) : (
            <Link to="/login">
              <Button className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-md">
                登录
              </Button>
            </Link>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <Button 
          variant="ghost" 
          size="icon"
          className="md:hidden rounded-xl"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="md:hidden glass-strong border-t border-border/30">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
            {user ? (
              <>
                <Button variant="ghost" className="w-full justify-start rounded-xl" onClick={(e) => { handleVideoLearnClick(e); setMobileMenuOpen(false); }}>
                  视频学习
                </Button>
                <Link to="/wordbook" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start rounded-xl">
                    <BookOpen className="w-4 h-4 mr-2" />
                    单词本
                  </Button>
                </Link>
                <Link to="/statistics" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start rounded-xl">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    学习统计
                  </Button>
                </Link>
                <Link to="/local-learn" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start rounded-xl">本地学习</Button>
                </Link>
                <div onClick={() => setMobileMenuOpen(false)}>
                  <AuthCodeDialog
                    trigger={
                      <Button variant="ghost" className="w-full justify-start rounded-xl">
                        <Ticket className="w-4 h-4 mr-2" />
                        授权码充值
                      </Button>
                    }
                  />
                </div>
                <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>
                  <div className="flex items-center gap-2 px-3 py-2 glass rounded-xl cursor-pointer hover:bg-accent/50 transition-colors">
                    <Crown className="w-4 h-4 text-primary" />
                    <span>专业评测: {professionalSeconds}秒</span>
                    <User className="w-3 h-3 text-muted-foreground" />
                  </div>
                </Link>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full justify-start rounded-xl">
                      <Settings className="w-4 h-4 mr-2" />
                      管理后台
                    </Button>
                  </Link>
                )}
                <Button variant="ghost" className="w-full justify-start rounded-xl hover:bg-destructive/10 hover:text-destructive" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  退出
                </Button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full rounded-xl bg-gradient-to-r from-primary to-accent">登录</Button>
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};