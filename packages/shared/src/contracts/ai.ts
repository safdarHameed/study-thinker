import { z } from 'zod';

/**
 * Model providers a learner can connect with their own API key. Every one except
 * Anthropic speaks the OpenAI chat-completions protocol.
 */
export const AI_PROVIDERS = [
  {
    id: 'huggingface',
    label: 'Hugging Face',
    baseUrl: 'https://router.huggingface.co/v1',
    keyUrl: 'https://huggingface.co/settings/tokens',
    keyHint: 'hf_…',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-…',
  },
  {
    id: 'google',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza…',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyUrl: 'https://console.groq.com/keys',
    keyHint: 'gsk_…',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys',
    keyHint: 'sk-or-…',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    keyUrl: 'https://console.mistral.ai/api-keys',
    keyHint: '',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyHint: 'sk-…',
  },
  {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    keyUrl: 'https://api.together.ai/settings/api-keys',
    keyHint: '',
  },
  {
    /** Local development only: the `claude` CLI on the server's computer. */
    id: 'claude-code',
    label: 'Claude Code (this computer)',
    baseUrl: 'local',
    keyUrl: '',
    keyHint: '',
  },
  {
    id: 'custom',
    label: 'Other (OpenAI-compatible)',
    baseUrl: '',
    keyUrl: '',
    keyHint: '',
  },
] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number]['id'];
export const AI_PROVIDER_IDS = AI_PROVIDERS.map((p) => p.id) as [AiProviderId, ...AiProviderId[]];

const providerId = z.enum(AI_PROVIDER_IDS);
const baseUrl = z
  .url('Enter a full URL, e.g. https://my-server.example/v1')
  .max(300)
  .refine((u) => /^https?:\/\//.test(u), 'Use an http(s) URL');

export const listModelsSchema = z
  .object({
    provider: providerId,
    apiKey: z.string().trim().min(1, 'Paste your API key').max(500),
    baseUrl: baseUrl.optional(),
  })
  .refine((v) => v.provider !== 'custom' || !!v.baseUrl, {
    path: ['baseUrl'],
    message: 'Enter the server URL',
  });
export type ListModelsInput = z.infer<typeof listModelsSchema>;

export interface AiModelInfo {
  id: string;
  label: string;
  /** Our pick for this key: a good, fast all-rounder that answered the test. */
  recommended?: boolean;
}

/** Hugging Face models are chosen by the server; the learner only pastes a key. */
export const providerPicksModel = (provider: AiProviderId) => provider === 'huggingface';

/** Runs on the server's own computer and needs no key (development only). */
export const isLocalProvider = (provider: AiProviderId) => provider === 'claude-code';
/** What a local provider sends in place of an API key. */
export const LOCAL_KEY = 'local';

export const createConnectionSchema = z
  .object({
    provider: providerId,
    apiKey: z.string().trim().min(1).max(500),
    baseUrl: baseUrl.optional(),
    /** Not needed for Hugging Face: the server picks a working model. */
    model: z.string().trim().min(1).max(200).optional(),
    label: z.string().trim().max(60).optional(),
  })
  .refine((v) => v.provider !== 'custom' || !!v.baseUrl, {
    path: ['baseUrl'],
    message: 'Enter the server URL',
  })
  .refine((v) => v.provider === 'huggingface' || !!v.model, {
    path: ['model'],
    message: 'Choose a model',
  });
export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

export const updateConnectionSchema = z.object({
  model: z.string().trim().min(1).max(200).optional(),
  label: z.string().trim().max(60).optional(),
});
export type UpdateConnectionInput = z.infer<typeof updateConnectionSchema>;

export interface AiConnection {
  id: string;
  provider: AiProviderId;
  label: string;
  model: string;
  baseUrl: string | null;
  /** Last characters of the key, e.g. "…a1b2". The key itself is never returned. */
  keyHint: string;
  /** Models that answered a test call with this key (newest check). */
  models: AiModelInfo[];
  /** The server picks (and switches) the model itself — Hugging Face. */
  automatic: boolean;
  createdAt: string;
}

export const setActiveAiSchema = z.object({
  /** null = the built-in Hugging Face models. */
  connectionId: z.uuid().nullable(),
  /** Built-in model to use when connectionId is null. */
  freeModel: z.string().max(200).optional(),
});
export type SetActiveAiInput = z.infer<typeof setActiveAiSchema>;

export interface AiSettings {
  /** Whether this server has a Hugging Face token for the built-in models. */
  builtInAvailable: boolean;
  builtInModels: AiModelInfo[];
  builtInModel: string;
  activeConnectionId: string | null;
  connections: AiConnection[];
  /** Spoken answers can be transcribed on the server (else the browser does it). */
  serverTranscription: boolean;
  /** This server may use the Claude Code CLI on its computer (local development only). */
  localClaudeCode: boolean;
}

export interface AiStatus {
  /** Some model is usable for this learner right now. */
  available: boolean;
  source: 'built-in' | 'own-key' | 'none';
  provider: string | null;
  model: string | null;
}
