import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AccessTokenClaims, UserRole } from '@studythinker/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfig } from '../../config/app-config.service.js';
import { AppException } from '../http/app-exception.js';
import { type AuthenticatedUser, IS_PUBLIC, ROLES } from './auth.decorators.js';

export function bearerToken(req: Request): string | undefined {
  const header = req.header('authorization');
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/**
 * Global guard: every route requires a valid learner access token unless it is
 * marked `@Public()`. Role checks are applied when `@Roles()` is present.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = bearerToken(req);
    if (!token) throw AppException.unauthenticated();

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        algorithms: ['HS256'],
        issuer: 'studythinker-api',
        audience: 'studythinker-web',
      });
    } catch {
      throw AppException.unauthenticated('Your session has expired. Please sign in again.');
    }
    if (claims.typ !== 'access') throw AppException.unauthenticated();

    // Access tokens are short-lived, but signing out, changing the password or deleting
    // the account must take effect immediately: the session has to still be live.
    // Refresh rotation replaces session rows within a family, so the family is the unit.
    const session = await this.prisma.authSession.findFirst({
      where: { id: claims.sid, userId: claims.sub },
      select: { familyId: true },
    });
    const live =
      session &&
      (await this.prisma.authSession.count({
        where: {
          familyId: session.familyId,
          userId: claims.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: { status: 'ACTIVE' },
        },
      }));
    if (!live) throw AppException.unauthenticated('Your session has ended. Please sign in again.');

    req.user = { id: claims.sub, role: claims.role, sessionId: claims.sid };

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    if (roles?.length && !roles.includes(claims.role)) throw AppException.forbidden();
    return true;
  }
}
