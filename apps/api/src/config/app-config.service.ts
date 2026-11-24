import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.js';

/** Typed accessor over validated environment configuration. */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get webOrigins(): string[] {
    return this.get('WEB_ORIGIN')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }
}
