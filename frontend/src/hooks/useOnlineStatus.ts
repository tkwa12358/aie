import { useState, useEffect, useCallback } from 'react';

interface UseOnlineStatusOptions {
  onOnline?: () => void;
  onOffline?: () => void;
}

export function useOnlineStatus(options: UseOnlineStatusOptions = {}) {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    options.onOnline?.();
  }, [options]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    options.onOffline?.();
  }, [options]);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return isOnline;
}
