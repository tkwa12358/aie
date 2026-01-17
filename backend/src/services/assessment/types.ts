export type AssessmentErrorType =
  | 'insufficient_balance'
  | 'auth_failed'
  | 'service_unavailable'
  | 'timeout'
  | 'invalid_request'
  | 'unknown';

export interface AssessmentRequest {
  text: string;
  audioData: string;
  language?: string;
}

export interface PhonemeResult {
  phoneme: string;           // 统一音素符号
  accuracy_score: number;    // 准确度 (0-100)
  is_correct: boolean;       // 是否正确 (>=60 为正确)
  error_type?: 'missing' | 'extra' | 'mispronounced' | 'replaced';  // 错误类型
}

export interface WordResult {
  word: string;
  accuracy_score: number;
  fluency_score?: number;
  error_type?: string;
  phonemes?: PhonemeResult[];  // 音素数组（仅 accuracy_score < 85 时填充）
}

export interface AssessmentResult {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  overallScore: number;
  words: WordResult[];
  feedback?: string;
  duration?: number;
}

export class AssessmentProviderError extends Error {
  type: AssessmentErrorType;
  details?: string;

  constructor(type: AssessmentErrorType, message: string, details?: string) {
    super(message);
    this.name = 'AssessmentProviderError';
    this.type = type;
    this.details = details;
  }
}
