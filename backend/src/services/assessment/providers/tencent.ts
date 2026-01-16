import axios from 'axios';
import crypto from 'crypto';
import { AssessmentProviderError, AssessmentRequest, AssessmentResult } from '../types';
import { decodeBase64Audio, getWavDurationSeconds } from '../audio';
import { parseProviderConfig, resolveProviderKey, resolveProviderSecret } from '../provider-config';

const buildTencentEndpoint = (provider: any) => provider.api_endpoint || 'https://soe.tencentcloudapi.com';

const sha256 = (data: string) => crypto.createHash('sha256').update(data).digest('hex');

const hmacSha256 = (key: Buffer | string, data: string) =>
  crypto.createHmac('sha256', key).update(data).digest();

const buildTencentHeaders = (provider: any, payload: any, secretId: string, secretKey: string) => {
  const host = new URL(buildTencentEndpoint(provider)).host;
  const service = 'soe';
  const action = 'TransmitOralProcessWithInit';
  const version = '2018-07-24';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const canonicalUri = '/';
  const canonicalQuerystring = '';
  const canonicalHeaders = `content-type:application/json\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const hashedRequestPayload = sha256(JSON.stringify(payload));
  const canonicalRequest = [
    'POST',
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload
  ].join('\n');

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    timestamp,
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n');

  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authorization,
    'Content-Type': 'application/json',
    Host: host,
    'X-TC-Action': action,
    'X-TC-Version': version,
    'X-TC-Timestamp': timestamp.toString(),
  };
};

const buildTencentPayload = (
  text: string,
  audioBase64: string,
  config: any,
  sessionId: string,
  seqId: number
) => ({
  RefText: text,
  ServerType: config.server_type ?? 0,
  EvalMode: config.eval_mode ?? 1,
  VoiceFileType: 3,
  VoiceEncodeType: config.voice_encode_type ?? 1,
  WorkMode: config.work_mode ?? 1,
  UserVoiceData: audioBase64,
  ScoreCoeff: config.score_coeff ?? 1.0,
  IsEnd: 1,
  SessionId: sessionId,
  SeqId: seqId
});

export const evaluateWithTencent = async (provider: any, payload: AssessmentRequest): Promise<AssessmentResult> => {
  const config = parseProviderConfig(provider);
  const secretId = resolveProviderKey(provider, config);
  const secretKey = resolveProviderSecret(provider, config);

  if (!secretId || !secretKey) {
    throw new AssessmentProviderError('auth_failed', '腾讯 SecretId/SecretKey 未配置');
  }

  const audioBuffer = decodeBase64Audio(payload.audioData);
  const duration = getWavDurationSeconds(audioBuffer) || undefined;
  const sessionId = crypto.randomUUID();
  const seqId = 1;
  const requestPayload = buildTencentPayload(payload.text, payload.audioData, config, sessionId, seqId);
  const headers = buildTencentHeaders(provider, requestPayload, secretId, secretKey);

  try {
    const response = await axios.post(buildTencentEndpoint(provider), requestPayload, {
      headers,
      timeout: 15000
    });

    const data = response.data?.Response || {};
    if (data.Error) {
      const code = data.Error.Code || 'TencentError';
      const message = data.Error.Message || '腾讯 SOE 评测失败';
      if (code.includes('Auth') || code.includes('Signature')) {
        throw new AssessmentProviderError('auth_failed', message, JSON.stringify(data.Error));
      }
      if (code.includes('NoFree') || code.includes('Insufficient')) {
        throw new AssessmentProviderError('insufficient_balance', message, JSON.stringify(data.Error));
      }
      throw new AssessmentProviderError('service_unavailable', message, JSON.stringify(data.Error));
    }

    return {
      pronunciationScore: data.PronAccuracy || 0,
      accuracyScore: data.PronAccuracy || 0,
      fluencyScore: data.PronFluency || 0,
      completenessScore: data.PronCompletion || 0,
      overallScore: data.SuggestedScore || 0,
      words: (data.Words || []).map((word: any) => ({
        word: word.Word || '',
        accuracy_score: word.PronAccuracy || 0,
        error_type: word.Pronunciation?.ErrorType
      })),
      feedback: data.Feedback || undefined,
      duration
    };
  } catch (error: any) {
    if (error instanceof AssessmentProviderError) {
      throw error;
    }
    if (error.response?.data?.Response?.Error) {
      const err = error.response.data.Response.Error;
      throw new AssessmentProviderError('service_unavailable', err.Message || '腾讯 SOE 调用失败', JSON.stringify(err));
    }
    if (error.code === 'ECONNABORTED') {
      throw new AssessmentProviderError('timeout', '腾讯 SOE 请求超时');
    }
    throw new AssessmentProviderError('unknown', '腾讯 SOE 调用失败', error.message);
  }
};
