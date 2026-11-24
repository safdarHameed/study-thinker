import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import argon2 from 'argon2';
import type {
  ChangePasswordInput,
  ForgotPasswordResult,
  ResetPasswordInput,
} from '@studythinker/shared';
import { AppException } from '../../common/http/app-exception.js';
import { AppConfig } from '../../config/app-config.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Mailer } from './mailer.js';
import { hashToken } from './token.service.js';

/** At most this many reset requests per account per hour (others are silently ignored). */
const MAX_REQUESTS_PER_HOUR = 3;

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly mailer: Mailer,
  ) {}

  /**
   * Starts a reset. The response is identical whether or not the email has an
   * account, so it cannot be used to discover who is registered.
   */
  async requestReset(email: string, ip?: string): Promise<ForgotPasswordResult> {
    const result = { emailDeliveryConfigured: this.mailer.deliversEmail };
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return result;

    const recent = await this.prisma.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
    });
    if (recent >= MAX_REQUESTS_PER_HOUR) return result;

    const token = randomBytes(32).toString('base64url');
    const ttl = this.config.get('PASSWORD_RESET_TTL_MINUTES');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttl * 60_000),
        requestedIp: ip?.slice(0, 64),
      },
    });
    const link = `${this.config.get('WEB_ORIGIN').replace(/\/$/, '')}/reset-password?token=${token}`;
    const delivery = await this.mailer.send({
      to: user.email,
      subject: 'Reset your StudyThinker password',
      text: `Someone asked to reset the password for this account.\n\nReset it here (valid for ${ttl} minutes): ${link}\n\nIf this wasn't you, you can ignore this message.`,
    });
    if (delivery.status === 'FAILED') {
      this.logger.warn(`Password reset email failed for user ${user.id}: ${delivery.error ?? ''}`);
    }
    return result;
  }

  /** Completes a reset: sets the new password, burns the token and signs out every session. */
  async reset(input: ResetPasswordInput): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
      include: { user: true },
    });
    if (
      !record ||
      record.usedAt ||
      record.expiresAt < new Date() ||
      record.user.status !== 'ACTIVE'
    ) {
      throw AppException.validation(
        'This reset link is invalid or has expired. Request a new one.',
      );
    }
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Conditional update guards against the same link being used twice concurrently.
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: now },
      });
      if (count !== 1) throw AppException.validation('This reset link has already been used.');
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: now },
      });
      await tx.authSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
    this.logger.log(`Password reset completed for user ${record.userId}`);
  }

  /** Changes the password of a signed-in user and signs out their other sessions. */
  async change(userId: string, sessionId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppException.unauthenticated();
    const valid = await argon2.verify(user.passwordHash, input.currentPassword).catch(() => false);
    if (!valid) throw AppException.validation('Your current password is not right.');
    if (input.currentPassword === input.newPassword) {
      throw AppException.validation('Choose a password that is different from your current one.');
    }
    const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
    const current = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      select: { familyId: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(current ? { familyId: { not: current.familyId } } : {}),
        },
        data: { revokedAt: new Date() },
      });
    });
  }
}
