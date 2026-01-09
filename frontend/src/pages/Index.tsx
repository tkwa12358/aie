import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Helmet } from 'react-helmet-async';
import { Play, BookOpen, Mic, Upload } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();

  // 已登录用户直接跳转到学习页面
  if (!loading && user) {
    return <Navigate to="/learn" replace />;
  }

  // 加载中显示空白，避免闪烁
  if (loading) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>AI English Club - 英语口语学习平台</title>
        <meta name="description" content="AI驱动的英语口语学习平台，支持视频跟读、语音评测、单词本等功能" />
      </Helmet>
      
      <div className="min-h-screen gradient-bg dark:gradient-bg-dark flex flex-col">
        {/* Hero Section */}
        <section className="flex-1 flex items-center justify-center py-12 md:py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              {/* AI Logo */}
              <div className="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-primary to-accent mx-auto mb-8 flex items-center justify-center shadow-xl rounded-3xl">
                <span className="text-primary-foreground font-bold text-4xl md:text-5xl">AI</span>
              </div>
              
              {/* Main Title */}
              <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent leading-tight">
                Let's speak now!
              </h1>
              
              {/* Subtitle */}
              <p className="text-lg md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
                专为<span className="text-primary font-medium">油管</span>、<span className="text-primary font-medium">TK</span>、<span className="text-primary font-medium">X</span>的英语口语设计的学习网站
              </p>
              
              {/* CTA Button */}
              <div className="flex justify-center">
                <Link to="/login">
                  <Button size="lg" className="text-xl px-12 py-7 rounded-2xl bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg hover:shadow-xl transition-all">
                    <Play className="w-6 h-6 mr-3" />
                    开始学习
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Core Features Section */}
        <section className="py-16 md:py-20 bg-background/30">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-muted-foreground">核心功能</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto">
              <div className="glass p-5 md:p-6 rounded-2xl hover:shadow-xl transition-all hover:-translate-y-1 text-center">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Play className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-2">视频学习</h3>
                <p className="text-sm text-muted-foreground">逐句复读、变速播放、AB循环</p>
              </div>
              <div className="glass p-5 md:p-6 rounded-2xl hover:shadow-xl transition-all hover:-translate-y-1 text-center">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-accent/40 to-accent/20 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Mic className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-2">语音评测</h3>
                <p className="text-sm text-muted-foreground">AI智能评分，多维度评测</p>
              </div>
              <div className="glass p-5 md:p-6 rounded-2xl hover:shadow-xl transition-all hover:-translate-y-1 text-center">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <BookOpen className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-2">单词本</h3>
                <p className="text-sm text-muted-foreground">点击即查，一键收藏</p>
              </div>
              <div className="glass p-5 md:p-6 rounded-2xl hover:shadow-xl transition-all hover:-translate-y-1 text-center">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-accent/40 to-primary/20 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Upload className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-2">本地学习</h3>
                <p className="text-sm text-muted-foreground">导入视频和SRT字幕</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Index;