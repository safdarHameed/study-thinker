import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode, type ApiError } from '@studythinker/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from './app-exception.js';

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_FAILED,
  401: ErrorCode.UNAUTHENTICATED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  429: ErrorCode.RATE_LIMITED,
};

/** Normalises every error into the `{ error: { code, message, details, requestId } }` envelope. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = req.id;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiError['error'] = {
      code: ErrorCode.INTERNAL,
      message: 'Something went wrong on our side. Please try again.',
      requestId,
    };

    if (exception instanceof AppException) {
      status = exception.getStatus();
      body = {
        code: exception.code,
        message: exception.message,
        details: exception.details,
        requestId,
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      const raw =
        typeof response === 'string'
          ? { message: response }
          : (response as Record<string, unknown>);
      const isValidation = status === 400 && (Array.isArray(raw.message) || raw.issues);
      body = {
        code:
          STATUS_TO_CODE[status] ??
          (status >= 500 ? ErrorCode.INTERNAL : ErrorCode.VALIDATION_FAILED),
        message: isValidation
          ? 'Some of the information provided is not valid.'
          : typeof raw.message === 'string'
            ? raw.message
            : exception.message,
        details: isValidation ? (raw.issues ?? raw.message) : undefined,
        requestId,
      };
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        body = { code: ErrorCode.NOT_FOUND, message: 'Resource not found', requestId };
      } else if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        body = { code: ErrorCode.CONFLICT, message: 'This already exists', requestId };
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status} [${requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({ error: body } satisfies ApiError);
  }
}
