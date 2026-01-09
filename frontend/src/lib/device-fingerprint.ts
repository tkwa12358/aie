/**
 * 简单设备指纹模块
 * 用于防止同一设备刷注册
 *
 * 注意：此方案为简化版，可被绕过（换浏览器、改分辨率等）
 * 但能阻止普通用户无限注册
 */

/**
 * 生成设备指纹
 * 基于浏览器基本特征生成一个相对稳定的指纹
 */
export function getDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,                              // 浏览器UA
    `${screen.width}x${screen.height}`,               // 屏幕分辨率
    screen.colorDepth?.toString() || '24',            // 颜色深度
    new Date().getTimezoneOffset().toString(),        // 时区偏移
    navigator.language || 'en',                       // 语言
    (navigator.hardwareConcurrency || 4).toString(),  // CPU核心数
    navigator.platform || 'unknown',                  // 平台
    (screen.pixelRatio || window.devicePixelRatio || 1).toString(), // 像素比
  ];

  // 简单哈希函数
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }

  return Math.abs(hash).toString(36);
}

/**
 * 获取或生成设备ID
 * 优先使用localStorage中存储的设备ID，否则生成新的
 */
export function getDeviceId(): string {
  const storageKey = 'deviceId';
  let deviceId = localStorage.getItem(storageKey);

  if (!deviceId) {
    deviceId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(storageKey, deviceId);
  }

  return deviceId;
}

/**
 * 获取完整的设备信息（用于登录时记录）
 */
export function getDeviceInfo(): string {
  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  return JSON.stringify(info);
}
