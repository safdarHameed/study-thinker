import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const optionalString = z
  .string()
  .optional()
  .transform((v) => v || undefined);

/** Hugging Face chat models offered as built-in choices (served via the HF router). */
export const DEFAULT_BUILT_IN_MODELS =
  'deepseek-ai/DeepSeek-V4.1-Flash,openai/gpt-oss-120b,zai-org/GLM-5.3-Flash,Qwen/Qwen3.8-27B,meta-llama/Llama-3.3-70B-Instruct';

/**
 * All configuration comes from environment variables and is validated once at
 * start-up. A misconfigured deployment fails fast with a readable message.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).default('log'),
  LOG_FORMAT: z.enum(['pretty', 'json']).optional(),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  COOKIE_SECURE: bool,
  COOKIE_DOMAIN: optionalString,

  /** Encrypts learners' own provider API keys at rest. Changing it makes saved keys unreadable. */
  AI_KEYS_SECRET: z.string().min(32),
  /** Development only: "1" lets this computer's Claude Code CLI answer (Settings → AI). */
  CLAUDE_CODE_LOCAL: optionalString,
  /** Hugging Face token for the built-in models. Without it learners must add their own key. */
  HF_TOKEN: optionalString,
  /** Comma-separated Hugging Face model ids; the first is the default. */
  HF_MODELS: z
    .string()
    .default(DEFAULT_BUILT_IN_MODELS)
    .transform((v) =>
      v
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
    ),
  /** Speech-to-text model for spoken answers (HF Inference). */
  HF_ASR_MODEL: z.string().default('openai/whisper-large-v3'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5000).default(120_000),

  SWAGGER_ENABLED: z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : v === 'true' || v === '1')),

  /** `log` (development: links written to the log), `none`, or `resend`. */
  MAIL_TRANSPORT: z.enum(['none', 'log', 'resend']).optional(),
  MAIL_FROM: optionalString,
  RESEND_API_KEY: optionalString,
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
});

const PLACEHOLDER = /change-me|changeme|example|placeholder/i;

/** Settings that are fine for local development but unsafe in production. */
export function productionProblems(env: z.infer<typeof envSchema>): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const problems: string[] = [];
  if (!env.COOKIE_SECURE) problems.push('COOKIE_SECURE must be true in production');
  for (const key of ['JWT_ACCESS_SECRET', 'AI_KEYS_SECRET'] as const) {
    if (PLACEHOLDER.test(env[key])) problems.push(`${key} still has a placeholder value`);
  }
  if (env.JWT_ACCESS_SECRET === env.AI_KEYS_SECRET)
    problems.push('JWT_ACCESS_SECRET and AI_KEYS_SECRET must differ');
  if (env.MAIL_TRANSPORT === 'log')
    problems.push('MAIL_TRANSPORT=log writes reset links to logs; use `resend` or `none`');
  if (env.MAIL_TRANSPORT === 'resend' && (!env.RESEND_API_KEY || !env.MAIL_FROM))
    problems.push('MAIL_TRANSPORT=resend needs RESEND_API_KEY and MAIL_FROM');
  if (/localhost|127\.0\.0\.1/.test(env.WEB_ORIGIN))
    problems.push('WEB_ORIGIN points at localhost');
  return problems;
}

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const problems = productionProblems(parsed.data);
  if (problems.length) {
    const message = `Unsafe production configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`;
    if (raw.ALLOW_INSECURE_LOCAL_PRODUCTION !== 'true') throw new Error(message);
    console.warn(`\n${message}\n  Starting anyway (ALLOW_INSECURE_LOCAL_PRODUCTION=true).\n`);
  }
  return parsed.data;
}
