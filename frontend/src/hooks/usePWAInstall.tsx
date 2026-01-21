import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallContextType {
  canInstall: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
  showInstallPrompt: () => void;
  isPromptVisible: boolean;
  setPromptVisible: (visible: boolean) => void;
  handleInstall: () => Promise<void>;
}

const PWAInstallContext = createContext<PWAInstallContextType | null>(null);

export function PWAInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPromptVisible, setPromptVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 检查是否是 iOS 设备
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    // 检查是否是 Android 设备
    const android = /Android/.test(navigator.userAgent);
    setIsAndroid(android);

    // 检查是否已安装为独立应用
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // 监听安装提示事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const showInstallPrompt = useCallback(() => {
    setPromptVisible(true);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setPromptVisible(false);
  }, [deferredPrompt]);

  // 可以安装的条件：未安装 && (是 iOS 或 是安卓)
  const canInstall = !isStandalone && (isIOS || isAndroid);

  return (
    <PWAInstallContext.Provider
      value={{
        canInstall,
        isIOS,
        isAndroid,
        isStandalone,
        showInstallPrompt,
        isPromptVisible,
        setPromptVisible,
        handleInstall,
      }}
    >
      {children}
    </PWAInstallContext.Provider>
  );
}

export function usePWAInstall() {
  const context = useContext(PWAInstallContext);
  if (!context) {
    throw new Error('usePWAInstall must be used within a PWAInstallProvider');
  }
  return context;
}
