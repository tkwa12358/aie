import { wordsApi, translateApi } from '@/lib/api-client';

interface CachedWord {
  word: string;
  phonetic: string;
  translation: string;
  definitions: { partOfSpeech: string; definition: string; example?: string }[];
  cachedAt: number;
}

const LOCAL_CACHE_KEY = 'word_cache';
const CACHE_EXPIRY_DAYS = 7;

// 本地缓存操作
export const getLocalCache = (): Record<string, CachedWord> => {
  try {
    const cached = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!cached) return {};

    const data = JSON.parse(cached);
    const now = Date.now();
    const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    // 过滤过期条目
    const validEntries: Record<string, CachedWord> = {};
    for (const [key, value] of Object.entries(data)) {
      const entry = value as CachedWord;
      if (now - entry.cachedAt < expiryMs) {
        validEntries[key] = entry;
      }
    }

    // 清理过期条目
    if (Object.keys(validEntries).length !== Object.keys(data).length) {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(validEntries));
    }

    return validEntries;
  } catch {
    return {};
  }
};

export const setLocalCache = (word: string, data: Omit<CachedWord, 'cachedAt'>) => {
  try {
    const cache = getLocalCache();
    cache[word.toLowerCase()] = { ...data, cachedAt: Date.now() };
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 忽略存储错误
  }
};

export const getFromLocalCache = (word: string): CachedWord | null => {
  const cache = getLocalCache();
  return cache[word.toLowerCase()] || null;
};

// Helper for simple lemmatization
const getWordVariations = (word: string): string[] => {
  const w = word.toLowerCase();
  const forms = new Set([w]);

  // Plural to Singular rules
  if (w.endsWith('s')) forms.add(w.slice(0, -1));
  if (w.endsWith('es')) forms.add(w.slice(0, -2));
  if (w.endsWith('ies')) forms.add(w.slice(0, -3) + 'y');
  if (w.endsWith('ves')) forms.add(w.slice(0, -3) + 'f');
  if (w.endsWith('ves')) forms.add(w.slice(0, -3) + 'fe');

  // Verb forms
  if (w.endsWith('ing')) forms.add(w.slice(0, -3));
  if (w.endsWith('ed')) forms.add(w.slice(0, -2));
  if (w.endsWith('d')) forms.add(w.slice(0, -1));

  return Array.from(forms);
};

const sanitizeDefinitions = (defs: any[]) => {
  if (!Array.isArray(defs)) return [];
  const hasChinese = (text: string) => /[\u4e00-\u9fa5]/.test(text);
  return defs.map(d => {
    if (!d) return null;
    let definition = d.definition;
    let partOfSpeech = d.partOfSpeech || 'unknown';
    let example = d.example || '';

    // 1. Handle stringified JSON (nested corruption)
    if (typeof definition === 'string' && definition.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(definition);
        if (parsed && typeof parsed === 'object') {
          definition = parsed.definition || parsed.translation || definition;
          if (parsed.partOfSpeech && partOfSpeech === 'unknown') partOfSpeech = parsed.partOfSpeech;
        }
      } catch { }
    }

    // 2. Handle object format
    if (typeof definition === 'object' && definition !== null) {
      definition = definition.definition || definition.translation || JSON.stringify(definition);
    }

    // Safety cast
    definition = String(definition || '');

    // Clean up 'unknown' if it's the only info (optional, or keeps it)

    return {
      partOfSpeech,
      definition,
      example
    };
  })
    .filter(d => d && d.definition && d.definition !== '{}' && d.definition !== 'undefined')
    // 3. User Request: Filter out pure English definitions (long descriptions)
    .filter(d => {
      // If it contains Chinese, keep it.
      if (hasChinese(d.definition)) return true;
      // If no Chinese, and length > 30 (likely a sentence/description), remove it
      if (d.definition.length > 30) return false;
      // Also remove if it looks like json
      if (d.definition.includes('{"')) return false;

      return true;
    });
};

// 数据库缓存操作 - 支持变体查询
export const getFromDbCache = async (word: string) => {
  const variations = getWordVariations(word);

  // 依次尝试每个变体形式
  for (const variation of variations) {
    try {
      const result = await wordsApi.getCachedWord(variation);
      if (result) {
        return {
          word: result.word,
          phonetic: result.phonetic || '',
          translation: result.translation || '',
          definitions: sanitizeDefinitions((result.definitions as any[]) || []),
        };
      }
    } catch {
      // 继续尝试下一个变体
    }
  }

  return null;
};

export const saveToDbCache = async (wordData: {
  word: string;
  phonetic: string;
  translation: string;
  definitions: { partOfSpeech: string; definition: string; example?: string }[];
}) => {
  try {
    await wordsApi.cacheWord({
      word: wordData.word.toLowerCase(),
      phonetic: wordData.phonetic,
      translation: wordData.translation,
      definitions: wordData.definitions,
    });
    return true;
  } catch {
    return false;
  }
};

// 从 API 获取单词信息
export const fetchFromApi = async (word: string) => {
  let wordInfo = {
    word,
    phonetic: '',
    translation: '',
    definitions: [] as { partOfSpeech: string; definition: string; example?: string }[],
  };

  try {
    // 1. 尝试 Free Dictionary API (English Definitions & Phonetic)
    try {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`
      );

      if (response.ok) {
        const data = await response.json();
        const entry = data[0];
        wordInfo.word = entry.word; // Use lemma if redirected (e.g. apples -> apple)
        wordInfo.phonetic = entry.phonetic || entry.phonetics?.[0]?.text || '';
        wordInfo.definitions = entry.meanings?.slice(0, 3).map((m: any) => ({
          partOfSpeech: m.partOfSpeech,
          definition: m.definitions?.[0]?.definition || '',
          example: m.definitions?.[0]?.example || '', // Capture example
        })) || [];
      }
    } catch (e) {
      console.warn('Free Dictionary API failed:', e);
    }

    // 2. 获取中文翻译 / 补全信息 (后端 API)
    try {
      const translationData = await translateApi.translate(word.toLowerCase(), 'en', 'zh');

      if (translationData) {
        // 优先使用 AI 返回的中文翻译
        if (translationData.translation) {
          wordInfo.translation = translationData.translation;
        }
        // 如果缺少音标，使用 AI 返回的
        if (!wordInfo.phonetic && translationData.phonetic) {
          wordInfo.phonetic = translationData.phonetic;
        }
        // 如果缺少定义，或者想要补充中文定义，这里我们可以合并或优先展示中文
        if (translationData.definitions && Array.isArray(translationData.definitions)) {
          try {
            console.log('Backend returned definitions:', translationData.definitions);
            const backendDefs = translationData.definitions
              .map((def: any) => {
                if (!def) return null;
                if (typeof def === 'string') {
                  return {
                    partOfSpeech: translationData.partOfSpeech || 'unknown',
                    definition: def,
                    example: ''
                  };
                }
                // Handle object format
                return {
                  partOfSpeech: def.partOfSpeech || 'unknown',
                  definition: def.definition || '',
                  example: def.example || ''
                };
              })
              .filter((d: any) => d !== null); // Filter out nulls

            // Deduplicate based on definition text
            const existingDefs = new Set(wordInfo.definitions.map(d => d.definition));
            const newDefs = backendDefs.filter((d: any) => d && !existingDefs.has(d.definition));

            // Append unique backend definitions
            wordInfo.definitions = [...wordInfo.definitions, ...newDefs];
          } catch (err) {
            console.error('Error processing backend definitions:', err);
          }
        }
      }
    } catch (translationError) {
      console.warn('Translation API failed:', translationError);
      // 3. Fallback: MyMemory API (Free, no key) if AI fails
      try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-CN`);
        const data = await res.json();
        if (data.responseData?.translatedText) {
          wordInfo.translation = data.responseData.translatedText;
          if (wordInfo.definitions.length === 0) {
            wordInfo.definitions.push({
              partOfSpeech: 'unknown',
              definition: data.responseData.translatedText
            });
          }
        }
      } catch (e) {
        console.warn('MyMemory Fallback failed:', e);
      }
    }

    return wordInfo;
  } catch (error) {
    console.error('Error fetching word info:', error);
    return null;
  }
};

// 主查询函数：本地缓存 -> 数据库缓存 -> API
export const lookupWord = async (word: string) => {
  const normalizedWord = word.toLowerCase();

  // 辅助函数：检查是否包含中文
  const hasChinese = (text: string | null | undefined): boolean => {
    if (!text) return false;
    return /[\u4e00-\u9fa5]/.test(text);
  };

  // 1. 先查本地缓存
  const localCached = getFromLocalCache(normalizedWord);
  if (localCached && localCached.translation && hasChinese(localCached.translation)) {
    return { ...localCached, definitions: sanitizeDefinitions(localCached.definitions || []), source: 'local' as const };
  }

  // 2. 查数据库缓存
  const dbCached = await getFromDbCache(normalizedWord);
  if (dbCached && dbCached.translation && hasChinese(dbCached.translation)) {
    // 存入本地缓存
    setLocalCache(normalizedWord, dbCached);
    return { ...dbCached, source: 'database' as const };
  }

  // 3. 调用 API (Fallback or Enrichment)
  // 当缓存无效或缺少中文翻译时执行
  console.log(`Searching API for ${normalizedWord} (Translation missing or valid cache not found)...`);
  const apiResult = await fetchFromApi(normalizedWord);
  if (apiResult) {
    // 如果数据库有音标但 API 没返回，保留数据库的音标
    if (dbCached && !apiResult.phonetic && dbCached.phonetic) {
      apiResult.phonetic = dbCached.phonetic;
    }

    // 存入数据库和本地缓存
    await saveToDbCache(apiResult);
    setLocalCache(normalizedWord, apiResult);
    return { ...apiResult, definitions: sanitizeDefinitions(apiResult.definitions || []), source: 'api' as const };
  }

  // If API failed but we had DB record (even without translation), return it as last resort
  if (dbCached) {
    return { ...dbCached, source: 'database' as const };
  }

  return null;
};
