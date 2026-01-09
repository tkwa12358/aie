import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Mic, Settings, Chrome, Apple, Smartphone, Monitor } from 'lucide-react';

interface MicPermissionGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DeviceType = 'ios' | 'android' | 'mac' | 'windows' | 'other';
type BrowserType = 'safari' | 'chrome' | 'wechat' | 'other';

const detectDevice = (): { device: DeviceType; browser: BrowserType } => {
  const ua = navigator.userAgent.toLowerCase();

  let device: DeviceType = 'other';
  let browser: BrowserType = 'other';

  // 检测设备类型
  if (/iphone|ipad|ipod/.test(ua)) {
    device = 'ios';
  } else if (/android/.test(ua)) {
    device = 'android';
  } else if (/macintosh|mac os x/.test(ua)) {
    device = 'mac';
  } else if (/windows/.test(ua)) {
    device = 'windows';
  }

  // 检测浏览器类型
  if (/micromessenger/.test(ua)) {
    browser = 'wechat';
  } else if (/safari/.test(ua) && !/chrome/.test(ua)) {
    browser = 'safari';
  } else if (/chrome/.test(ua)) {
    browser = 'chrome';
  }

  return { device, browser };
};

export const MicPermissionGuide = ({
  open,
  onOpenChange
}: MicPermissionGuideProps) => {
  const [deviceInfo, setDeviceInfo] = useState<{ device: DeviceType; browser: BrowserType }>({
    device: 'other',
    browser: 'other'
  });

  useEffect(() => {
    setDeviceInfo(detectDevice());
  }, []);

  const isMobile = deviceInfo.device === 'ios' || deviceInfo.device === 'android';

  const getDeviceIcon = () => {
    if (deviceInfo.device === 'ios') return <Apple className="w-6 h-6" />;
    if (deviceInfo.device === 'android') return <Smartphone className="w-6 h-6" />;
    return <Monitor className="w-6 h-6" />;
  };

  const getGuideContent = () => {
    // iOS 设备
    if (deviceInfo.device === 'ios') {
      if (deviceInfo.browser === 'wechat') {
        return {
          title: 'iOS 微信浏览器',
          steps: [
            '点击右上角「...」菜单',
            '选择「在Safari中打开」',
            '在Safari中重新打开本页面',
            '点击录音按钮时允许麦克风权限'
          ],
          note: '微信内置浏览器对麦克风权限支持有限，建议使用Safari浏览器'
        };
      }
      return {
        title: 'iPhone / iPad',
        steps: [
          '打开「设置」应用',
          '向下滑动找到「Safari浏览器」（或当前使用的浏览器）',
          '点击进入后找到「麦克风」选项',
          '确保麦克风权限已开启',
          '返回本页面重试录音'
        ],
        note: '如果在浏览器弹窗中选择了「不允许」，需要在系统设置中重新开启'
      };
    }

    // Android 设备
    if (deviceInfo.device === 'android') {
      if (deviceInfo.browser === 'wechat') {
        return {
          title: 'Android 微信浏览器',
          steps: [
            '点击右上角「...」菜单',
            '选择「在浏览器中打开」',
            '在系统浏览器中重新访问本页面',
            '点击录音按钮时允许麦克风权限'
          ],
          note: '微信内置浏览器权限受限，建议使用Chrome或系统浏览器'
        };
      }
      return {
        title: 'Android 手机',
        steps: [
          '打开手机「设置」',
          '找到「应用管理」或「应用程序」',
          '找到当前使用的浏览器（如Chrome）',
          '点击「权限」→「麦克风」',
          '选择「允许」或「仅在使用时允许」',
          '返回本页面重试录音'
        ],
        note: '不同品牌手机设置路径可能略有不同'
      };
    }

    // Mac 电脑
    if (deviceInfo.device === 'mac') {
      return {
        title: 'Mac 电脑',
        steps: [
          '点击左上角  菜单 → 「系统偏好设置」',
          '选择「安全性与隐私」',
          '点击「隐私」标签页',
          '在左侧选择「麦克风」',
          '勾选当前使用的浏览器（如Chrome、Safari）',
          '可能需要点击左下角锁图标解锁后才能修改',
          '返回本页面重试录音'
        ],
        note: '修改后可能需要重启浏览器才能生效'
      };
    }

    // Windows 电脑
    if (deviceInfo.device === 'windows') {
      return {
        title: 'Windows 电脑',
        steps: [
          '点击「开始」菜单 → 「设置」（齿轮图标）',
          '选择「隐私」→「麦克风」',
          '确保「允许应用访问麦克风」已开启',
          '向下滚动找到浏览器，确保其权限已开启',
          '返回本页面重试录音'
        ],
        note: '如果浏览器地址栏左侧有锁或相机图标，也可以点击直接管理权限'
      };
    }

    // 其他设备
    return {
      title: '开启麦克风权限',
      steps: [
        '在浏览器弹出权限请求时，请点击「允许」',
        '如果没有弹窗，请检查浏览器地址栏是否有麦克风图标',
        '点击该图标可以管理麦克风权限',
        '也可以在系统设置中为浏览器开启麦克风权限'
      ],
      note: '如需帮助，请参考您设备的使用手册'
    };
  };

  const guide = getGuideContent();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-destructive" />
            麦克风权限未开启
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 设备类型显示 */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            {getDeviceIcon()}
            <div>
              <p className="font-medium text-sm">{guide.title}</p>
              <p className="text-xs text-muted-foreground">
                {isMobile ? '移动设备' : '桌面设备'}
              </p>
            </div>
          </div>

          {/* 操作步骤 */}
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Settings className="w-4 h-4" />
              请按以下步骤开启权限：
            </p>
            <ol className="space-y-2 ml-2">
              {guide.steps.map((step, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* 提示信息 */}
          {guide.note && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                💡 {guide.note}
              </p>
            </div>
          )}

          {/* 浏览器快捷提示（PC端） */}
          {!isMobile && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-200 flex items-center gap-1">
                <Chrome className="w-3 h-3" />
                快捷方式：点击浏览器地址栏左侧的锁图标或麦克风图标，直接管理权限
              </p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              我知道了
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
