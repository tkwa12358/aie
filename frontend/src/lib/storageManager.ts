/**
 * 存储管理工具
 * 提供存储配额查询、空间检查等功能
 */

export interface StorageInfo {
  usage: number;
  quota: number;
  usagePercent: number;
  available: number;
}

/**
 * 格式化字节大小为人类可读格式
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 获取存储使用情况
 */
export async function getStorageInfo(): Promise<StorageInfo | null> {
  if (!navigator.storage || !navigator.storage.estimate) {
    console.warn('Storage API not supported');
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const available = quota - usage;
    const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;

    return {
      usage,
      quota,
      usagePercent,
      available,
    };
  } catch (error) {
    console.error('Failed to get storage estimate:', error);
    return null;
  }
}

/**
 * 检查是否有足够的存储空间
 */
export async function hasEnoughSpace(requiredBytes: number): Promise<boolean> {
  const info = await getStorageInfo();
  if (!info) return true; // 无法检测时假设有足够空间

  // 预留 10% 的安全边距
  const safeAvailable = info.available * 0.9;
  return safeAvailable >= requiredBytes;
}

/**
 * 请求持久化存储
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist) {
    console.warn('Persistent storage not supported');
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) {
      return true;
    }

    return await navigator.storage.persist();
  } catch (error) {
    console.error('Failed to request persistent storage:', error);
    return false;
  }
}

/**
 * 检查是否已启用持久化存储
 */
export async function isPersistentStorage(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persisted) {
    return false;
  }

  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

/**
 * 获取 Cache Storage 中特定缓存的大小
 */
export async function getCacheSize(cacheName: string): Promise<number> {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let totalSize = 0;

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    }

    return totalSize;
  } catch (error) {
    console.error('Failed to get cache size:', error);
    return 0;
  }
}

/**
 * 清除特定缓存
 */
export async function clearCache(cacheName: string): Promise<boolean> {
  try {
    return await caches.delete(cacheName);
  } catch (error) {
    console.error('Failed to clear cache:', error);
    return false;
  }
}

/**
 * 获取所有缓存名称
 */
export async function getAllCacheNames(): Promise<string[]> {
  try {
    return await caches.keys();
  } catch (error) {
    console.error('Failed to get cache names:', error);
    return [];
  }
}
