import axios from 'axios';
import { AssessmentProviderError, AssessmentRequest, AssessmentResult } from '../types';
import { decodeBase64Audio, getWavDurationSeconds, getWavSampleRate } from '../audio';
import { parseProviderConfig, resolveProviderKey } from '../provider-config';

const buildEndpoint = (provider: any) => {
  const region = provider.region || 'eastasia';
  const base = provider.api_endpoint || `https://${region}.stt.speech.microsoft.com`;
  const normalized = base.includes('{region}') ? base.replace('{region}', region) : base;
  return `${normalized}/speech/recognition/conversation/cognitiveservices/v1`;
};

const buildPronunciationConfig = (text: string) => {
  const payload = {
    ReferenceText: text,
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    EnableMiscue: true
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};

export const evaluateWithAzure = async (provider: any, payload: AssessmentRequest): Promise<AssessmentResult> => {
  const config = parseProviderConfig(provider);
  const apiKey = resolveProviderKey(provider, config);
  if (!apiKey) {
    throw new AssessmentProviderError('auth_failed', 'Azure 订阅密钥未配置');
  }

  const audioBuffer = decodeBase64Audio(payload.audioData);
  const sampleRate = getWavSampleRate(audioBuffer) || 16000;
  const duration = getWavDurationSeconds(audioBuffer) || undefined;
  const url = `${buildEndpoint(provider)}?language=${payload.language || 'en-US'}&format=detailed`;

  try {
    const response = await axios.post(url, audioBuffer, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': `audio/wav; codecs=audio/pcm; samplerate=${sampleRate}`,
        'Pronunciation-Assessment': buildPronunciationConfig(payload.text)
      },
      timeout: 15000
    });

    const data = response.data || {};
    const best = data.NBest?.[0] || {};
    const assessment = best.PronunciationAssessment || {};
    const words = Array.isArray(best.Words) ? best.Words : [];

    return {
      pronunciationScore: assessment.PronunciationScore || 0,
      accuracyScore: assessment.AccuracyScore || 0,
      fluencyScore: assessment.FluencyScore || 0,
      completenessScore: assessment.CompletenessScore || 0,
      overallScore: assessment.PronunciationScore || 0,
      words: words.map((word: any) => ({
        word: word.Word || '',
        accuracy_score: word.PronunciationAssessment?.AccuracyScore || 0,
        error_type: word.PronunciationAssessment?.ErrorType
      })),
      feedback: assessment.ProsodyScore ? `韵律分: ${assessment.ProsodyScore}` : undefined,
      duration
    };
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.response.data?.message || 'Azure 评测失败';
      if (status === 401 || status === 403) {
        throw new AssessmentProviderError('auth_failed', message, JSON.stringify(error.response.data));
      }
      if (status === 429) {
        throw new AssessmentProviderError('service_unavailable', 'Azure 服务限流', JSON.stringify(error.response.data));
      }
      throw new AssessmentProviderError('service_unavailable', message, JSON.stringify(error.response.data));
    }

    if (error.code === 'ECONNABORTED') {
      throw new AssessmentProviderError('timeout', 'Azure 请求超时');
    }
    throw new AssessmentProviderError('unknown', 'Azure 服务调用失败', error.message);
  }
};
