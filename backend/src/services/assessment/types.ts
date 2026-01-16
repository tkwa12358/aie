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

export interface WordResult {
  word: string;
  accuracy_score: number;
  error_type?: string;
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
