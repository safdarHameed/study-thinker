import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';

const RAW_RESPONSE = 'lw:raw-response';
/** Opt a handler out of the `{ data }` envelope (e.g. health checks). */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true);

/** Marker returned by handlers that need to attach `meta` alongside `data`. */
export class Enveloped<T> {
  constructor(
    readonly data: T,
    readonly meta?: Record<string, unknown>,
  ) {}
}

/** Wraps successful JSON responses as `{ data, meta? }` and serialises dates to ISO strings. */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw || context.getType() !== 'http') return next.handle();

    return next.handle().pipe(
      map((value) => {
        if (value === undefined) return undefined;
        if (value instanceof Enveloped)
          return { data: value.data, ...(value.meta ? { meta: value.meta } : {}) };
        return { data: value };
      }),
    );
  }
}
