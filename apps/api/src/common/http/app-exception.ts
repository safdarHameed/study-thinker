import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@studythinker/shared';

/** Domain error carrying a stable machine-readable code for the error envelope. */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }

  static notFound(entity: string) {
    return new AppException(ErrorCode.NOT_FOUND, `${entity} not found`, HttpStatus.NOT_FOUND);
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new AppException(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static unauthenticated(message = 'Authentication required') {
    return new AppException(ErrorCode.UNAUTHENTICATED, message, HttpStatus.UNAUTHORIZED);
  }

  static conflict(message: string, details?: unknown) {
    return new AppException(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT, details);
  }

  static validation(message: string, details?: unknown) {
    return new AppException(ErrorCode.VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST, details);
  }

  static aiUnavailable(message = 'AI features are not available right now', details?: unknown) {
    return new AppException(
      ErrorCode.AI_UNAVAILABLE,
      message,
      HttpStatus.SERVICE_UNAVAILABLE,
      details,
    );
  }
}
