import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import argon2 from 'argon2';
import type { AuthSession, AuthUser, LoginInput, RegisterInput } from '@studythinker/shared';
import type { User } from '../../generated/prisma/client.js';
import { AppException } from '../../common/http/app-exception.js';
import { iso } from '../../common/utils/serialize.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { hashToken, TokenService } from './token.service.js';

export interface ClientInfo {
  userAgent?: string;
  ipAddress?: string;
}

// Verified against when the email does not exist, so login timing does not reveal accounts.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () =>
  (dummyHash ??= argon2.hash('studythinker-timing-equaliser', { type: argon2.argon2id }));

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterInput, client: ClientInfo): Promise<AuthSession> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw AppException.conflict('An account with this email already exists');

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: { email: input.email, passwordHash, displayName: input.displayName },
    });
    return this.startSession(user, client);
  }

  async login(input: LoginInput, client: ClientInfo): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const valid = await argon2
      .verify(user?.passwordHash ?? (await getDummyHash()), input.password)
      .catch(() => false);
    if (!user || !valid || user.status !== 'ACTIVE') {
      throw AppException.unauthenticated('That email and password combination is not right');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.startSession(user, client);
  }

  /**
   * Rotates a refresh token. Presenting a token that was already rotated or
   * revoked indicates theft: the whole token family is revoked.
   */
  async refresh(refreshToken: string, client: ClientInfo): Promise<AuthSession> {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!session)
      throw AppException.unauthenticated('Your session has ended. Please sign in again.');

    if (session.revokedAt || session.replacedById) {
      await this.prisma.authSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(`Refresh token reuse detected for user ${session.userId}; family revoked`);
      throw AppException.unauthenticated('Your session has ended. Please sign in again.');
    }
    if (session.expiresAt < new Date() || session.user.status !== 'ACTIVE') {
      throw AppException.unauthenticated('Your session has expired. Please sign in again.');
    }

    const next = this.tokens.createRefreshToken();
    const created = await this.prisma.$transaction(async (tx) => {
      const created = await tx.authSession.create({
        data: {
          userId: session.userId,
          familyId: session.familyId,
          tokenHash: next.hash,
          expiresAt: next.expiresAt,
          userAgent: client.userAgent?.slice(0, 512),
          ipAddress: client.ipAddress?.slice(0, 64),
          lastUsedAt: new Date(),
        },
      });
      // Conditional update guards against two concurrent refreshes of the same token.
      const { count } = await tx.authSession.updateMany({
        where: { id: session.id, replacedById: null, revokedAt: null },
        data: { replacedById: created.id, revokedAt: new Date(), lastUsedAt: new Date() },
      });
      if (count !== 1)
        throw AppException.unauthenticated('Your session has ended. Please sign in again.');
      return created;
    });

    const access = await this.tokens.signAccessToken(session.user, created.id);
    return {
      user: this.toAuthUser(session.user),
      tokens: {
        accessToken: access.token,
        accessTokenExpiresAt: access.expiresAt.toISOString(),
        refreshToken: next.token,
        refreshTokenExpiresAt: next.expiresAt.toISOString(),
      },
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { familyId: true },
    });
    if (!session) return;
    await this.prisma.authSession.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw AppException.unauthenticated();
    return this.toAuthUser(user);
  }

  private async startSession(user: User, client: ClientInfo): Promise<AuthSession> {
    const refresh = this.tokens.createRefreshToken();
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        familyId: randomUUID(),
        tokenHash: refresh.hash,
        expiresAt: refresh.expiresAt,
        userAgent: client.userAgent?.slice(0, 512),
        ipAddress: client.ipAddress?.slice(0, 64),
      },
    });
    const access = await this.tokens.signAccessToken(user, session.id);
    return {
      user: this.toAuthUser(user),
      tokens: {
        accessToken: access.token,
        accessTokenExpiresAt: access.expiresAt.toISOString(),
        refreshToken: refresh.token,
        refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
      },
    };
  }

  toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: iso(user.createdAt)!,
    };
  }
}
