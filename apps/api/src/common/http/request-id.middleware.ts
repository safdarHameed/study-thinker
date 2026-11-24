import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Assigns every request an id (honouring a well-formed incoming `X-Request-Id`). */
export function requestIdMiddleware(
  req: Request & { id?: string },
  res: Response,
  next: NextFunction,
) {
  const incoming = req.header('x-request-id');
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
