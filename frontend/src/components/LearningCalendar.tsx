import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DayActivity {
  date: string;
  practiceTime: number;
  completedSentences: number;
}

interface LearningCalendarProps {
  activityData: DayActivity[];
  currentStreak: number;
  longestStreak: number;
}

export const LearningCalendar = ({ 
  activityData, 
  currentStreak, 
  longestStreak 
}: LearningCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const activityMap = useMemo(() => {
    const map = new Map<string, DayActivity>();
    activityData.forEach(day => {
      map.set(day.date, day);
    });
    return map;
  }, [activityData]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startDayOfWeek, year, month };
  };

  const { daysInMonth, startDayOfWeek, year, month } = getDaysInMonth(currentMonth);

  const previousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const formatDateKey = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getActivityLevel = (dateKey: string) => {
    const activity = activityMap.get(dateKey);
    if (!activity || activity.practiceTime === 0) return 0;
    if (activity.practiceTime < 300) return 1; // < 5 min
    if (activity.practiceTime < 900) return 2; // < 15 min
    if (activity.practiceTime < 1800) return 3; // < 30 min
    return 4; // >= 30 min
  };

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      {/* 连续学习天数 */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl border border-primary/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
            <Flame className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{currentStreak} 天</div>
            <div className="text-sm text-muted-foreground">当前连续学习 Current Streak</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">{longestStreak} 天</div>
          <div className="text-xs text-muted-foreground">最长连续 Best Streak</div>
        </div>
      </div>

      {/* 日历头部 */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={previousMonth}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-medium">
          {year}年 {monthNames[month]}
        </span>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* 星期标题 */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-1">
        {/* 填充月初空白 */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        
        {/* 日期 */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateKey = formatDateKey(day);
          const level = getActivityLevel(dateKey);
          const activity = activityMap.get(dateKey);
          const isToday = dateKey === todayKey;
          const isFuture = new Date(dateKey) > today;

          return (
            <div
              key={day}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative group cursor-default transition-all",
                isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                isFuture && "opacity-30",
                level === 0 && "bg-muted/30",
                level === 1 && "bg-primary/20",
                level === 2 && "bg-primary/40",
                level === 3 && "bg-primary/60",
                level === 4 && "bg-primary/80 text-primary-foreground"
              )}
            >
              <span className={cn(
                "font-medium",
                level >= 3 && "text-primary-foreground"
              )}>
                {day}
              </span>
              
              {/* Tooltip */}
              {activity && activity.practiceTime > 0 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border border-border rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                  <div className="text-xs font-medium">{Math.floor(activity.practiceTime / 60)}分钟</div>
                  <div className="text-xs text-muted-foreground">{activity.completedSentences}句完成</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <span className="text-xs text-muted-foreground">少</span>
        <div className="w-4 h-4 rounded bg-muted/30" />
        <div className="w-4 h-4 rounded bg-primary/20" />
        <div className="w-4 h-4 rounded bg-primary/40" />
        <div className="w-4 h-4 rounded bg-primary/60" />
        <div className="w-4 h-4 rounded bg-primary/80" />
        <span className="text-xs text-muted-foreground">多</span>
      </div>
    </div>
  );
};