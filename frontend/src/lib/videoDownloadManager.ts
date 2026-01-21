/**
 * 视频下载管理器
 * 处理视频和字幕的离线缓存
 */

import { formatBytes } from './storageManager';

// 缓存名称
const VIDEO_CACHE_NAME = 'ai-english-videos-v1';
const METADATA_DB_NAME = 'ai-english-downloads';
const METADATA_STORE_NAME = 'videos';

export interface VideoMetadata {
  id: string;
  videoId: number;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
  subtitleUrls: string[];
  size: number;
  downloadedAt: number;
}

export interface DownloadProgress {
  videoId: number;
  loaded: number;
  total: number;
  percent: number;
}

type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * 打开 IndexedDB 数据库
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(METADATA_DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
        db.createObjectStore(METADATA_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * 保存视频元数据
 */
async function saveMetadata(metadata: VideoMetadata): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(METADATA_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(METADATA_STORE_NAME);
    const request = store.put(metadata);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * 获取所有已下载视频的元数据
 */
export async function getAllDownloadedVideos(): Promise<VideoMetadata[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(METADATA_STORE_NAME, 'readonly');
    const store = transaction.objectStore(METADATA_STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * 根据视频 ID 获取下载的元数据
 */
export async function getDownloadedVideo(videoId: number): Promise<VideoMetadata | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(METADATA_STORE_NAME, 'readonly');
    const store = transaction.objectStore(METADATA_STORE_NAME);
    const request = store.get(`video-${videoId}`);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * 检查视频是否已下载
 */
export async function isVideoDownloaded(videoId: number): Promise<boolean> {
  const metadata = await getDownloadedVideo(videoId);
  return metadata !== null;
}

/**
 * 获取已下载视频的缓存 URL
 */
export async function getCachedVideoUrl(videoUrl: string): Promise<string | null> {
  try {
    const cache = await caches.open(VIDEO_CACHE_NAME);
    const response = await cache.match(videoUrl);
    if (response) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
    return null;
  } catch (error) {
    console.error('Failed to get cached video:', error);
    return null;
  }
}

/**
 * 带进度的 fetch
 */
async function fetchWithProgress(
  url: string,
  videoId: number,
  onProgress?: ProgressCallback
): Promise<Response> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (!onProgress || !response.body) {
    return response;
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!total) {
    return response;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    chunks.push(value);
    loaded += value.length;

    onProgress({
      videoId,
      loaded,
      total,
      percent: Math.round((loaded / total) * 100),
    });
  }

  const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'video/mp4' });
  return new Response(blob, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * 下载视频和字幕到缓存
 */
export async function downloadVideo(
  videoId: number,
  title: string,
  videoUrl: string,
  subtitleUrls: string[],
  thumbnailUrl?: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const cache = await caches.open(VIDEO_CACHE_NAME);
  let totalSize = 0;

  // 下载视频
  const videoResponse = await fetchWithProgress(videoUrl, videoId, onProgress);
  const videoBlob = await videoResponse.clone().blob();
  totalSize += videoBlob.size;
  await cache.put(videoUrl, videoResponse);

  // 下载字幕
  for (const subtitleUrl of subtitleUrls) {
    try {
      const subtitleResponse = await fetch(subtitleUrl);
      if (subtitleResponse.ok) {
        const subtitleBlob = await subtitleResponse.clone().blob();
        totalSize += subtitleBlob.size;
        await cache.put(subtitleUrl, subtitleResponse);
      }
    } catch (error) {
      console.warn('Failed to download subtitle:', subtitleUrl, error);
    }
  }

  // 下载缩略图
  if (thumbnailUrl) {
    try {
      const thumbnailResponse = await fetch(thumbnailUrl);
      if (thumbnailResponse.ok) {
        const thumbnailBlob = await thumbnailResponse.clone().blob();
        totalSize += thumbnailBlob.size;
        await cache.put(thumbnailUrl, thumbnailResponse);
      }
    } catch (error) {
      console.warn('Failed to download thumbnail:', thumbnailUrl, error);
    }
  }

  // 保存元数据
  const metadata: VideoMetadata = {
    id: `video-${videoId}`,
    videoId,
    title,
    videoUrl,
    thumbnailUrl,
    subtitleUrls,
    size: totalSize,
    downloadedAt: Date.now(),
  };

  await saveMetadata(metadata);
}

/**
 * 删除已下载的视频
 */
export async function deleteDownloadedVideo(videoId: number): Promise<void> {
  const metadata = await getDownloadedVideo(videoId);
  if (!metadata) return;

  const cache = await caches.open(VIDEO_CACHE_NAME);

  // 删除视频缓存
  await cache.delete(metadata.videoUrl);

  // 删除字幕缓存
  for (const subtitleUrl of metadata.subtitleUrls) {
    await cache.delete(subtitleUrl);
  }

  // 删除缩略图缓存
  if (metadata.thumbnailUrl) {
    await cache.delete(metadata.thumbnailUrl);
  }

  // 删除元数据
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(METADATA_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(METADATA_STORE_NAME);
    const request = store.delete(metadata.id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * 删除所有已下载的视频
 */
export async function clearAllDownloads(): Promise<void> {
  // 删除缓存
  await caches.delete(VIDEO_CACHE_NAME);

  // 清空元数据
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(METADATA_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(METADATA_STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * 获取已下载视频的总大小
 */
export async function getTotalDownloadSize(): Promise<number> {
  const videos = await getAllDownloadedVideos();
  return videos.reduce((total, video) => total + video.size, 0);
}

/**
 * 获取格式化的总下载大小
 */
export async function getFormattedTotalDownloadSize(): Promise<string> {
  const size = await getTotalDownloadSize();
  return formatBytes(size);
}
