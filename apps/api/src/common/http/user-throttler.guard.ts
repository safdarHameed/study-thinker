import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limits per signed-in learner (falling back to the client IP for public
 * routes). Registered after the JWT guard so `req.user` is already set.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    return user?.id ? `user:${user.id}` : `ip:${String(req.ip)}`;
  }
}
