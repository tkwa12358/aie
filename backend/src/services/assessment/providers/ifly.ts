import axios from 'axios';
import crypto from 'crypto';
import { AssessmentProviderError, AssessmentRequest, AssessmentResult } from '../types';
import { decodeBase64Audio, extractWavPcmData, getWavDurationSeconds, getWavSampleRate } from '../audio';
import { parseProviderConfig, resolveProviderKey, resolveProviderSecret } from '../provider-config';

const buildIflyEndpoint = (provider: any) => {
  const base = provider.api_endpoint || 'https://api.xfyun.cn';
  return `${base.replace(/\/+$/, '')}/v1/service/v1/ise`;
};

const buildIflyHeaders = (appId: string, apiKey: string, param: string) => {
  const curTime = Math.floor(Date.now() / 1000).toString();
  const checkSum = crypto.createHash('md5').update(apiKey + curTime + param).digest('hex');

  return {
    'Content-Type': 'application/octet-stream',
    'X-Appid': appId,
    'X-CurTime': curTime,
    'X-Param': param,
    'X-CheckSum': checkSum
  };
};

const buildIflyParam = (text: string, sampleRate: number, config: any) => {
  const payload = {
    aue: config.aue ?? 'raw',
    result_level: config.result_level ?? 'entirety',
    language: config.language ?? 'en_us',
    category: config.category ?? 'read_sentence',
    auf: config.auf ?? `audio/L16;rate=${sampleRate}`,
    text
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};

const mapIflyResult = (data: any): AssessmentResult => {
  const result = data?.data || {};
  const overall = result.total_score || result.score || 0;
  const words = Array.isArray(result.word) ? result.word : [];

  return {
    pronunciationScore: overall,
    accuracyScore: overall,
    fluencyScore: result.fluency || overall,
    completenessScore: result.integrity || overall,
    overallScore: overall,
    words: words.map((word: any) => ({
      word: word.word || '',
      accuracy_score: word.score || 0,
      error_type: word.error_type
    })),
    feedback: result.message || undefined
  };
};

export const evaluateWithIfly = async (provider: any, payload: AssessmentRequest): Promise<AssessmentResult> => {
  const config = parseProviderConfig(provider);
  const appId = resolveProviderKey(provider, config);
  const apiKey = resolveProviderSecret(provider, config);

  if (!appId || !apiKey) {
    throw new AssessmentProviderError('auth_failed', '讯飞 AppId/APIKey 未配置');
  }

  const audioBuffer = decodeBase64Audio(payload.audioData);
  const sampleRate = getWavSampleRate(audioBuffer) || 16000;
  const audioBody = extractWavPcmData(audioBuffer);
  const duration = getWavDurationSeconds(audioBuffer) || undefined;
  const param = buildIflyParam(payload.text, sampleRate, config);
  const headers = buildIflyHeaders(appId, apiKey, param);

  try {
    const response = await axios.post(buildIflyEndpoint(provider), audioBody, {
      headers,
      timeout: 15000
    });

    const data = response.data;
    if (data?.code && data.code !== '0') {
      const message = data.desc || data.message || '讯飞评测失败';
      if (data.code === '11200' || data.code === '11201') {
        throw new AssessmentProviderError('insufficient_balance', message, JSON.stringify(data));
      }
      if (data.code === '10105' || data.code === '10106') {
        throw new AssessmentProviderError('auth_failed', message, JSON.stringify(data));
      }
      throw new AssessmentProviderError('service_unavailable', message, JSON.stringify(data));
    }

    const result = mapIflyResult(data);
    return { ...result, duration };
  } catch (error: any) {
    if (error instanceof AssessmentProviderError) {
      throw error;
    }
    if (error.code === 'ECONNABORTED') {
      throw new AssessmentProviderError('timeout', '讯飞评测请求超时');
    }
    throw new AssessmentProviderError('unknown', '讯飞评测调用失败', error.message);
  }
};
