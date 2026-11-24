/**
 * HTTP API conventions shared by every StudyThinker client and service.
 *
 * - Every successful response body is `{ data: T, meta?: {...} }`.
 * - Every error response body is `{ error: { code, message, details?, requestId? } }`.
 * - Collections are cursor-paginated: `?cursor=<opaque>&limit=<1..100>`.
 * - Routes are versioned under `/v1`.
 * - Timestamps are ISO-8601 strings in UTC; IDs are UUIDs.
 */
import { z } from 'zod';

export const API_VERSION = 'v1';

export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  CAPABILITY_UNAVAILABLE: 'CAPABILITY_UNAVAILABLE',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const paginationQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const pageMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PageMeta;
}

export const idParamSchema = z.object({ id: z.uuid() });

export const isoDateTime = z.iso.datetime({ offset: true });
export const isoDate = z.iso.date();
