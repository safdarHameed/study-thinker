import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import type { AuthUser } from '@studythinker/shared';
import { AppException } from '../../common/http/app-exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async update(userId: string, displayName: string): Promise<AuthUser> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { displayName } });
    return this.auth.toAuthUser(user);
  }

  /** Everything we hold about the learner, except secrets (password and token hashes, API keys). */
  async export(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        displayName: true,
        createdAt: true,
        lastLoginAt: true,
        builtInModel: true,
      },
    });
    const [connections, learnings] = await Promise.all([
      this.prisma.aiConnection.findMany({
        where: { userId },
        select: {
          provider: true,
          label: true,
          model: true,
          baseUrl: true,
          keyHint: true,
          createdAt: true,
        },
      }),
      this.prisma.learning.findMany({
        where: { userId },
        include: {
          steps: { orderBy: { position: 'asc' } },
          conversations: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
          assessments: true,
        },
      }),
    ]);
    return {
      format: 'studythinker-export',
      version: 2,
      exportedAt: new Date().toISOString(),
      account: user,
      aiConnections: connections,
      learnings,
    };
  }

  async delete(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppException.unauthenticated();
    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) throw AppException.validation('Your password is not right.');
    // Everything else cascades from the user.
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
