import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');
const QUIET = new Set(['/health', '/ready']);

/**
 * One structured line per request: id, method, route path (never the query
 * string or body, which can hold tokens), status, duration and user id.
 */
export function requestLoggerMiddleware(
  req: Request & { id?: string; user?: { id: string } },
  res: Response,
  next: NextFunction,
) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0] ?? '';
    if (QUIET.has(path) && res.statusCode < 400) return;
    const entry = {
      event: 'http.request',
      requestId: req.id,
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Number((process.hrtime.bigint() - started) / 1_000_000n),
      userId: req.user?.id,
    };
    const line = JSON.stringify(entry);
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });
  next();
}
