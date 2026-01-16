import { AssessmentProviderError, AssessmentRequest, AssessmentResult } from './types';
import { evaluateWithAzure } from './providers/azure';
import { evaluateWithTencent } from './providers/tencent';
import { evaluateWithIfly } from './providers/ifly';

const shouldFallback = (error: unknown) => {
  if (error instanceof AssessmentProviderError) {
    return error.type !== 'invalid_request';
  }
  return true;
};

const normalizeProviderType = (type: string) => {
  if (type === 'tencent_soe') return 'tencent';
  return type;
};

export const evaluatePronunciation = async (provider: any, payload: AssessmentRequest): Promise<AssessmentResult> => {
  const providerType = normalizeProviderType(provider.provider_type);

  switch (providerType) {
    case 'azure':
      return evaluateWithAzure(provider, payload);
    case 'tencent':
      return evaluateWithTencent(provider, payload);
    case 'ifly':
      return evaluateWithIfly(provider, payload);
    default:
      throw new AssessmentProviderError('invalid_request', `不支持的评测服务商类型: ${provider.provider_type}`);
  }
};

export { AssessmentProviderError, AssessmentRequest, AssessmentResult, shouldFallback };
