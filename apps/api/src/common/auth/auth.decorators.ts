import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '@studythinker/shared';

export const IS_PUBLIC = 'lw:is-public';
/** Skips learner JWT authentication (the route may still use another guard). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'lw:roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  sessionId: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!req.user) throw new Error('CurrentUser used on a route without authentication');
    return req.user;
  },
);
