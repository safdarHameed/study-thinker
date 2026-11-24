import { Injectable, Logger } from '@nestjs/common';
import type {
  AiConnection,
  AiModelInfo,
  AiProviderId,
  AiSettings,
  AiStatus,
  CreateConnectionInput,
  ListModelsInput,
  SetActiveAiInput,
  UpdateConnectionInput,
} from '@studythinker/shared';
import { providerPicksModel } from '@studythinker/shared';
import { createHash } from 'node:crypto';
import type { z } from 'zod';
import type { AiConnection as AiConnectionRow } from '../../generated/prisma/client.js';
import { claudeCodeEnabled } from './claude-code.js';
import { AppException } from '../../common/http/app-exception.js';
import { AppConfig } from '../../config/app-config.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { KeyVault, keyHint } from './crypto.js';
import { parseWith } from './json.js';
import {
  AiError,
  type AiErrorCode,
  chat,
  type ChatMessage,
  type ChatOptions,
  type ChatTarget,
  listModels,
  mainFailure,
  prettyModel,
  probeModels,
  providerInfo,
  rankModels,
  resolveBaseUrl,
  transcribe,
} from './providers.js';

export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  /** Stream: called with each new piece of the answer as it is written. */
  onDelta?: (piece: string) => void;
}

export interface JsonOptions {
  maxTokens?: number;
  temperature?: number;
  /** Stream: called with everything written so far in the current attempt. */
  onText?: (soFar: string) => void;
}

const HF_ROUTER = 'https://router.huggingface.co/v1';
/** How many of a key's best-ranked models get a test message. */
const MAX_CHECKED = 12;
const CACHE_MS = 15 * 60_000;
/** Errors after which the server may move on to its next model. */
const SWITCH_ON = new Set<AiErrorCode>(['bad_model', 'unavailable']);

interface Route {
  list: ChatTarget[];
  /** Set for a Hugging Face connection, so a model switch is remembered. */
  connectionId: string | null;
  switched: boolean;
}

/** Converts provider failures into the API's error envelope. */
export function toHttpError(err: unknown): unknown {
  if (err instanceof AiError) return AppException.aiUnavailable(err.message, { reason: err.code });
  return err;
}

/**
 * Every AI call goes through here. It picks the learner's model: their own
 * connection when they chose one, otherwise the built-in Hugging Face models.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly vault: KeyVault;
  /** Recently verified model lists, by a hash of the key (never the key itself). */
  private readonly verified = new Map<string, { at: number; models: AiModelInfo[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {
    this.vault = new KeyVault(config.get('AI_KEYS_SECRET'));
  }

  // ───────────────────────── Generation ─────────────────────────

  async text(userId: string, messages: ChatMessage[], opts: GenerateOptions = {}): Promise<string> {
    return this.call(await this.route(userId), messages, opts);
  }

  /**
   * Asks for JSON matching `schema`. If the answer doesn't validate, the model
   * is shown the problems once and asked to fix them.
   */
  async json<T>(
    userId: string,
    schema: z.ZodType<T>,
    messages: ChatMessage[],
    { onText, ...opts }: JsonOptions = {},
  ): Promise<T> {
    const route = await this.route(userId);
    const history = [...messages];
    for (let attempt = 1; attempt <= 2; attempt++) {
      let soFar = '';
      const answer = await this.call(route, history, {
        ...opts,
        json: true,
        onDelta: onText
          ? (piece) => {
              soFar += piece;
              onText(soFar);
            }
          : undefined,
      });
      const parsed = parseWith(schema, answer);
      if (parsed.ok) return parsed.value;
      this.logger.warn(
        JSON.stringify({
          event: 'ai.invalid_json',
          model: route.list[0]?.model,
          attempt,
          error: parsed.error.slice(0, 300),
        }),
      );
      history.push(
        { role: 'assistant', content: answer.slice(0, 12_000) },
        {
          role: 'user',
          content: `That JSON is not valid: ${parsed.error}. Reply again with ONLY the corrected JSON object, no other text.`,
        },
      );
    }
    throw toHttpError(new AiError('invalid_output'));
  }

  /**
   * One model call. When the server picks the model (built-in or Hugging Face),
   * a model that is missing or down is skipped for the next good one — and that
   * choice is remembered for the learner's connection.
   */
  private async call(
    route: Route,
    messages: ChatMessage[],
    opts: Omit<ChatOptions, 'timeoutMs'>,
  ): Promise<string> {
    let lastErr: unknown;
    for (let tries = 0; tries < 3; tries++) {
      const target = route.list[0];
      if (!target) break;
      const started = Date.now();
      let streamed = false;
      try {
        const out = await chat(target, messages, {
          ...opts,
          timeoutMs: this.config.get('AI_TIMEOUT_MS'),
          onDelta: opts.onDelta
            ? (piece) => {
                streamed = true;
                opts.onDelta!(piece);
              }
            : undefined,
        });
        this.logger.log(
          JSON.stringify({
            event: 'ai.call',
            provider: target.provider,
            model: target.model,
            ms: Date.now() - started,
          }),
        );
        if (route.switched && route.connectionId) {
          await this.prisma.aiConnection
            .update({ where: { id: route.connectionId }, data: { model: target.model } })
            .catch(() => undefined);
          route.switched = false;
        }
        return out;
      } catch (err) {
        lastErr = err;
        this.logger.warn(
          JSON.stringify({
            event: 'ai.call_failed',
            provider: target.provider,
            model: target.model,
            code: err instanceof AiError ? err.code : 'error',
            detail: err instanceof AiError ? err.detail?.slice(0, 200) : (err as Error).message,
          }),
        );
        const canSwitch =
          err instanceof AiError && SWITCH_ON.has(err.code) && !streamed && route.list.length > 1;
        if (!canSwitch) break;
        route.list.shift();
        route.switched = true;
      }
    }
    throw toHttpError(lastErr);
  }

  async transcribe(userId: string, audio: Buffer, mimeType: string): Promise<string> {
    const target = await this.transcriptionTarget(userId);
    if (!target) throw AppException.aiUnavailable('Speech-to-text is not set up on this server.');
    try {
      return await transcribe(target, audio, mimeType, this.config.get('AI_TIMEOUT_MS'));
    } catch (err) {
      throw toHttpError(err);
    }
  }

  // ───────────────────────── Model selection ─────────────────────────

  private get builtInModels(): string[] {
    return this.config.get('HF_MODELS');
  }

  /** The model(s) to use for this learner, best first. */
  private async route(userId: string): Promise<Route> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { activeConnectionId: true, builtInModel: true },
    });
    if (user.activeConnectionId) {
      const conn = await this.prisma.aiConnection.findFirst({
        where: { id: user.activeConnectionId, userId },
      });
      if (conn) {
        const t = this.connectionTarget(conn);
        if (!providerPicksModel(t.provider))
          return { list: [t], connectionId: null, switched: false };
        const ids = unique([t.model, ...modelsOf(conn).map((m) => m.id), ...this.builtInModels]);
        return {
          list: ids.map((model) => ({ ...t, model })),
          connectionId: conn.id,
          switched: false,
        };
      }
    }
    const token = this.config.get('HF_TOKEN');
    if (!token) throw toHttpError(new AiError('not_configured'));
    const first =
      user.builtInModel && this.builtInModels.includes(user.builtInModel)
        ? user.builtInModel
        : this.builtInModels[0]!;
    return {
      list: unique([first, ...this.builtInModels]).map((model) => ({
        provider: 'huggingface' as const,
        baseUrl: HF_ROUTER,
        apiKey: token,
        model,
      })),
      connectionId: null,
      switched: false,
    };
  }

  private connectionTarget(conn: AiConnectionRow): ChatTarget {
    const provider = conn.provider as AiProviderId;
    let apiKey: string;
    try {
      apiKey = this.vault.decrypt(conn.encryptedKey);
    } catch {
      throw AppException.aiUnavailable(
        'Your saved API key can no longer be read. Add it again in Settings → AI.',
      );
    }
    return { provider, baseUrl: resolveBaseUrl(provider, conn.baseUrl), apiKey, model: conn.model };
  }

  private async transcriptionTarget(userId: string) {
    const model = this.config.get('HF_ASR_MODEL');
    const token = this.config.get('HF_TOKEN');
    if (token) return { kind: 'huggingface' as const, token, model };
    const conns = await this.prisma.aiConnection.findMany({ where: { userId } });
    const hf = conns.find((c) => c.provider === 'huggingface');
    if (hf) return { kind: 'huggingface' as const, token: this.connectionTarget(hf).apiKey, model };
    const openai = conns.find((c) => c.provider === 'openai');
    if (openai) {
      const t = this.connectionTarget(openai);
      return { kind: 'openai' as const, baseUrl: t.baseUrl, apiKey: t.apiKey };
    }
    return null;
  }

  async status(userId: string): Promise<AiStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeConnectionId: true, builtInModel: true },
    });
    if (user?.activeConnectionId) {
      const conn = await this.prisma.aiConnection.findFirst({
        where: { id: user.activeConnectionId, userId },
      });
      if (conn)
        return { available: true, source: 'own-key', provider: conn.provider, model: conn.model };
    }
    if (this.config.get('HF_TOKEN')) {
      const model =
        user?.builtInModel && this.builtInModels.includes(user.builtInModel)
          ? user.builtInModel
          : this.builtInModels[0]!;
      return { available: true, source: 'built-in', provider: 'huggingface', model };
    }
    return { available: false, source: 'none', provider: null, model: null };
  }

  // ───────────────────────── Settings ─────────────────────────

  async settings(userId: string): Promise<AiSettings> {
    const [user, conns] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { activeConnectionId: true, builtInModel: true },
      }),
      this.prisma.aiConnection.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);
    const builtInAvailable = !!this.config.get('HF_TOKEN');
    const active = conns.some((c) => c.id === user.activeConnectionId)
      ? user.activeConnectionId
      : null;
    return {
      builtInAvailable,
      builtInModels: this.builtInModels.map((id) => ({ id, label: id.split('/').pop() ?? id })),
      builtInModel:
        user.builtInModel && this.builtInModels.includes(user.builtInModel)
          ? user.builtInModel
          : this.builtInModels[0]!,
      activeConnectionId: active,
      connections: conns.map(toConnection),
      serverTranscription:
        builtInAvailable ||
        conns.some((c) => c.provider === 'huggingface' || c.provider === 'openai'),
      localClaudeCode: claudeCodeEnabled(),
    };
  }

  /**
   * The models this key can really use: listed by the provider, narrowed to
   * chat models, ranked, and each sent a tiny test message. Only the ones that
   * answered come back.
   */
  async models(input: ListModelsInput): Promise<AiModelInfo[]> {
    const base = {
      provider: input.provider,
      baseUrl: resolveBaseUrl(input.provider, input.baseUrl),
      apiKey: input.apiKey.trim(),
    };
    const models = await this.verify(base);
    this.verified.set(cacheKey(base), { at: Date.now(), models });
    return models;
  }

  private async verify(base: Omit<ChatTarget, 'model'>): Promise<AiModelInfo[]> {
    const label = providerInfo(base.provider).label;
    let candidates: AiModelInfo[];
    if (providerPicksModel(base.provider)) {
      candidates = this.builtInModels.map((id) => ({ id, label: prettyModel(id) }));
    } else {
      let all: AiModelInfo[];
      try {
        all = await listModels(base.provider, base.baseUrl, base.apiKey);
      } catch (err) {
        throw explain(err, label);
      }
      if (!all.length)
        throw AppException.validation(`This ${label} key works, but it has no chat models.`);
      candidates = rankModels(base.provider, all).slice(0, MAX_CHECKED);
    }
    const { working, failed } = await probeModels(base, candidates, {
      concurrency: 4,
      timeoutMs: 25_000,
    });
    if (!working.length) throw explain(mainFailure(failed), label, true);
    return working.map((m, i) => ({
      id: m.id,
      label: m.label === m.id ? prettyModel(m.id) : m.label,
      ...(i === 0 ? { recommended: true } : {}),
    }));
  }

  /** Saves a connection whose model answered a test call, and makes it the active model. */
  async createConnection(userId: string, input: CreateConnectionInput): Promise<AiConnection> {
    const base = {
      provider: input.provider,
      baseUrl: resolveBaseUrl(input.provider, input.baseUrl),
      apiKey: input.apiKey.trim(),
    };
    const count = await this.prisma.aiConnection.count({ where: { userId } });
    if (count >= 10) throw AppException.validation('You can save up to 10 connections.');
    const cached = this.verified.get(cacheKey(base));
    const fresh = cached && Date.now() - cached.at < CACHE_MS ? cached.models : null;
    let models: AiModelInfo[];
    let model: string;
    if (providerPicksModel(base.provider)) {
      models = fresh ?? (await this.verify(base));
      model = models[0]!.id;
    } else {
      model = input.model!;
      if (fresh?.some((m) => m.id === model)) models = fresh;
      else {
        await this.checkOne(base, model);
        models = fresh ?? [{ id: model, label: prettyModel(model), recommended: true }];
      }
    }
    const conn = await this.prisma.aiConnection.create({
      data: {
        userId,
        provider: base.provider,
        label: input.label || providerInfo(base.provider).label,
        model,
        models: models as object[],
        baseUrl: base.provider === 'custom' || input.baseUrl ? base.baseUrl : null,
        encryptedKey: this.vault.encrypt(base.apiKey),
        keyHint: keyHint(base.apiKey),
      },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { activeConnectionId: conn.id } });
    return toConnection(conn);
  }

  private async checkOne(base: Omit<ChatTarget, 'model'>, model: string) {
    const { working, failed } = await probeModels(base, [{ id: model, label: model }], {
      concurrency: 1,
      timeoutMs: 30_000,
    });
    if (!working.length) throw explain(failed[0]?.error, providerInfo(base.provider).label);
  }

  async updateConnection(userId: string, id: string, input: UpdateConnectionInput) {
    const conn = await this.prisma.aiConnection.findFirst({ where: { id, userId } });
    if (!conn) throw AppException.notFound('Connection');
    if (
      input.model &&
      input.model !== conn.model &&
      !modelsOf(conn).some((m) => m.id === input.model)
    ) {
      const t = this.connectionTarget(conn);
      await this.checkOne(t, input.model);
    }
    const updated = await this.prisma.aiConnection.update({
      where: { id },
      data: { model: input.model, label: input.label },
    });
    return toConnection(updated);
  }

  /** Checks the saved key again and remembers which models answer now. */
  async connectionModels(userId: string, id: string): Promise<AiModelInfo[]> {
    const conn = await this.prisma.aiConnection.findFirst({ where: { id, userId } });
    if (!conn) throw AppException.notFound('Connection');
    const t = this.connectionTarget(conn);
    const models = await this.verify(t);
    const keepModel = models.some((m) => m.id === conn.model);
    await this.prisma.aiConnection.update({
      where: { id },
      data: {
        models: models as object[],
        ...(!keepModel && providerPicksModel(t.provider) ? { model: models[0]!.id } : {}),
      },
    });
    return models;
  }

  async deleteConnection(userId: string, id: string) {
    const { count } = await this.prisma.aiConnection.deleteMany({ where: { id, userId } });
    if (!count) throw AppException.notFound('Connection');
    await this.prisma.user.updateMany({
      where: { id: userId, activeConnectionId: id },
      data: { activeConnectionId: null },
    });
  }

  async setActive(userId: string, input: SetActiveAiInput) {
    if (input.connectionId) {
      const conn = await this.prisma.aiConnection.findFirst({
        where: { id: input.connectionId, userId },
      });
      if (!conn) throw AppException.notFound('Connection');
    }
    if (input.freeModel && !this.builtInModels.includes(input.freeModel)) {
      throw AppException.validation('That built-in model is not offered on this server.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        activeConnectionId: input.connectionId,
        ...(input.freeModel ? { builtInModel: input.freeModel } : {}),
      },
    });
    return this.settings(userId);
  }
}

function toConnection(c: AiConnectionRow): AiConnection {
  return {
    id: c.id,
    provider: c.provider as AiProviderId,
    label: c.label,
    model: c.model,
    baseUrl: c.baseUrl,
    keyHint: c.keyHint,
    models: modelsOf(c),
    automatic: providerPicksModel(c.provider as AiProviderId),
    createdAt: c.createdAt.toISOString(),
  };
}

function modelsOf(c: AiConnectionRow): AiModelInfo[] {
  const list = Array.isArray(c.models) ? (c.models as unknown as AiModelInfo[]) : [];
  return list.length ? list : [{ id: c.model, label: prettyModel(c.model) }];
}

function unique(ids: string[]) {
  return [...new Set(ids)];
}

function cacheKey(t: Omit<ChatTarget, 'model'>) {
  return createHash('sha256').update(`${t.provider}|${t.baseUrl}|${t.apiKey}`).digest('hex');
}

/** A clear, provider-named message for why a key or model doesn't work. */
function explain(err: unknown, provider: string, checkingModels = false): unknown {
  if (!(err instanceof AiError)) return err;
  const text: Partial<Record<AiErrorCode, string>> = {
    auth: `${provider} didn’t accept this key. Check that you copied all of it and that it is still active.`,
    no_credit: `${provider} says this account has no credit left. Add credit with ${provider}, or use another key.`,
    quota: `This ${provider} key has used up its quota (free plans have per-minute and per-day limits). Wait for it to reset, or enable billing with ${provider}.`,
    rate_limited: `${provider} is limiting requests right now. Wait a minute and try again.`,
    timeout: `${provider} took too long to answer. Try again in a moment.`,
    unavailable: `${provider} couldn’t be reached. Try again in a moment.`,
    bad_model: checkingModels
      ? `None of this key’s ${provider} models answered a test message. The key may not have access to chat models.`
      : `This model doesn’t work with your ${provider} key. Pick one from the list.`,
  };
  return AppException.aiUnavailable(text[err.code] ?? err.message, { reason: err.code });
}
