import type { ErrorCode } from '@studythinker/shared';

/** Error codes produced by the API plus client-side failure modes. */
export type ApiErrorCode = ErrorCode | 'NETWORK_ERROR' | 'UNKNOWN';

export interface ApiErrorInit {
  code: ApiErrorCode | (string & {});
  message: string;
  status: number;
  details?: unknown;
  requestId?: string;
}

/** A typed error for every failed API call. `status` is 0 when the network failed. */
export class ApiError extends Error {
  readonly code: ApiErrorInit['code'];
  readonly status: number;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.details = init.details;
    this.requestId = init.requestId;
  }

  get isNetworkError() {
    return this.code === 'NETWORK_ERROR';
  }
  get isUnauthenticated() {
    return this.status === 401 || this.code === 'UNAUTHENTICATED';
  }
  get isNotFound() {
    return this.status === 404 || this.code === 'NOT_FOUND';
  }
  get isAiUnavailable() {
    return this.code === 'AI_UNAVAILABLE' || this.code === 'CAPABILITY_UNAVAILABLE';
  }
  get isValidation() {
    return this.code === 'VALIDATION_FAILED';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Plain-language explanation of an error, safe to show to learners. */
export function describeError(error: unknown): { title: string; description: string } {
  if (!isApiError(error)) {
    return {
      title: 'Something went wrong',
      description: 'An unexpected problem occurred. Please try again in a moment.',
    };
  }
  switch (error.code) {
    case 'NETWORK_ERROR':
      return {
        title: 'We can’t reach StudyThinker right now',
        description:
          'The StudyThinker service isn’t responding. Check your connection, or try again in a moment.',
      };
    case 'UNAUTHENTICATED':
      return {
        title: 'Please sign in again',
        description: 'Your session has ended. Sign in to pick up where you left off.',
      };
    case 'FORBIDDEN':
      return {
        title: 'You don’t have access to this',
        description: 'This item belongs to another account or isn’t available to you.',
      };
    case 'NOT_FOUND':
      return {
        title: 'We couldn’t find that',
        description: 'It may have been removed, or the link might be incorrect.',
      };
    case 'RATE_LIMITED':
      return {
        title: 'Let’s take a short pause',
        description: 'Too many requests in a short time. Please wait a moment and try again.',
      };
    case 'AI_UNAVAILABLE':
    case 'CAPABILITY_UNAVAILABLE':
      // The server explains exactly what went wrong (bad key, quota, model down…).
      return {
        title: 'The AI couldn’t answer',
        description:
          error.message ||
          'This feature needs an AI provider, and none is configured on this StudyThinker server yet.',
      };
    case 'VALIDATION_FAILED':
      return {
        title: 'Some details need another look',
        description: error.message || 'Please check the highlighted fields and try again.',
      };
    default:
      return {
        title: 'Something went wrong',
        description: error.message || 'An unexpected problem occurred. Please try again.',
      };
  }
}
