import { Logger } from '@nestjs/common';
import { ErrorCode } from '@studythinker/shared';
import type { Response } from 'express';
import { AppException } from './app-exception.js';

const logger = new Logger('SSE');

/**
 * Runs `work` and streams its progress as server-sent events: `delta`/`status`
 * events while it runs, then `done` with the result (or `error`). Errors before
 * the first event are thrown, so they get a normal HTTP error response.
 */
export async function streamResponse<T>(
  res: Response,
  work: (emit: (event: { type: string; text?: string }) => void) => Promise<T>,
): Promise<void> {
  let started = false;
  let closed = false;
  res.on('close', () => {
    closed = true;
  });
  const write = (event: object) => {
    if (closed || res.writableEnded) return;
    if (!started) {
      started = true;
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
    }
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  try {
    const result = await work(write);
    write({ type: 'done', result });
  } catch (err) {
    if (!started) throw err;
    if (!(err instanceof AppException)) logger.error((err as Error).stack ?? String(err));
    write({
      type: 'error',
      error:
        err instanceof AppException
          ? { code: err.code, message: err.message, details: err.details }
          : {
              code: ErrorCode.INTERNAL,
              message: 'Something went wrong on our side. Please try again.',
            },
    });
  }
  if (!res.writableEnded) res.end();
}
