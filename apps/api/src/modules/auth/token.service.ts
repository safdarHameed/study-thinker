import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenClaims, UserRole } from '@studythinker/shared';
import { AppConfig } from '../../config/app-config.service.js';

export const ACCESS_ISSUER = 'studythinker-api';
export const ACCESS_AUDIENCE = 'studythinker-web';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  async signAccessToken(user: { id: string; role: UserRole }, sessionId: string) {
    const ttl = this.config.get('JWT_ACCESS_TTL_SECONDS');
    const claims: AccessTokenClaims = {
      sub: user.id,
      role: user.role,
      sid: sessionId,
      typ: 'access',
    };
    const token = await this.jwt.signAsync(claims, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      algorithm: 'HS256',
      expiresIn: ttl,
      issuer: ACCESS_ISSUER,
      audience: ACCESS_AUDIENCE,
      jwtid: randomUUID(),
    });
    return { token, expiresAt: new Date(Date.now() + ttl * 1000) };
  }

  /** Opaque, high-entropy refresh token. Only its SHA-256 hash is stored. */
  createRefreshToken() {
    const token = randomBytes(48).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS');
    return {
      token,
      hash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
    };
  }
}
