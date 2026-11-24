import type {
  AiConnection,
  AiModelInfo,
  AiSettings,
  AiStatus,
  AssessmentDetail,
  AssessmentSummary,
  AuthSession,
  AuthUser,
  ChangePasswordInput,
  Conversation,
  ConversationKind,
  CreateAssessmentInput,
  CreateConnectionInput,
  CreateLearningInput,
  DeleteAccountInput,
  ForgotPasswordResult,
  GuideRequest,
  LearningDetail,
  LearningPreferences,
  LearningSummary,
  ListModelsInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  SendMessageResult,
  SetActiveAiInput,
  StepDetail,
  StepStatus,
  UpdateConnectionInput,
  UpdateLearningInput,
  HistoryEntry,
  LearnerProgress,
} from '@studythinker/shared';
import { createApiClient } from './client';
import { type StreamHandlers, streamPost } from './stream';
import { ApiError } from './errors';

export * from './errors';
export type { StreamHandlers } from './stream';
export { createApiClient } from './client';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);

type SessionListener = (session: AuthSession | null) => void;
const sessionListeners = new Set<SessionListener>();

/** Subscribe to session changes caused by token refreshes or auth failures. */
export function onSessionChange(listener: SessionListener) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export const apiClient = createApiClient({
  baseUrl: API_URL,
  onSession: (session) => sessionListeners.forEach((l) => l(session)),
  onAuthFailure: () => sessionListeners.forEach((l) => l(null)),
});

const r = apiClient.request;
const stream = <T>(path: string, body: unknown, handlers?: StreamHandlers, signal?: AbortSignal) =>
  streamPost<T>(
    { baseUrl: API_URL, getToken: apiClient.getAccessToken, refresh: apiClient.refresh },
    path,
    body,
    handlers,
    signal,
  );
const enc = encodeURIComponent;

/** Raw-body upload (audio) with the same auth/refresh behaviour as JSON requests. */
async function upload<T>(path: string, body: Blob): Promise<T> {
  const send = () =>
    fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': body.type || 'application/octet-stream',
        ...(apiClient.getAccessToken()
          ? { Authorization: `Bearer ${apiClient.getAccessToken()}` }
          : {}),
      },
      body,
      credentials: 'include',
    });
  let res = await send();
  if (res.status === 401) {
    await apiClient.refresh();
    res = await send();
  }
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { code: string; message: string };
  } | null;
  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      code: json?.error?.code ?? 'UNKNOWN',
      message: json?.error?.message ?? 'Request failed',
    });
  }
  return json?.data as T;
}

export const api = {
  auth: {
    register: (input: RegisterInput) =>
      r<AuthSession>('/v1/auth/register', { method: 'POST', body: input, auth: false }),
    login: (input: LoginInput) =>
      r<AuthSession>('/v1/auth/login', { method: 'POST', body: input, auth: false }),
    refresh: () => apiClient.refresh(),
    logout: () => r<void>('/v1/auth/logout', { method: 'POST', retryOnUnauthorized: false }),
    me: () => r<AuthUser>('/v1/auth/me'),
    forgotPassword: (email: string) =>
      r<ForgotPasswordResult>('/v1/auth/password/forgot', {
        method: 'POST',
        body: { email },
        auth: false,
      }),
    resetPassword: (input: ResetPasswordInput) =>
      r<void>('/v1/auth/password/reset', { method: 'POST', body: input, auth: false }),
    changePassword: (input: ChangePasswordInput) =>
      r<void>('/v1/auth/password/change', { method: 'POST', body: input }),
  },
  account: {
    update: (displayName: string) =>
      r<AuthUser>('/v1/me', { method: 'PATCH', body: { displayName } }),
    export: () => r<unknown>('/v1/me/export'),
    remove: (input: DeleteAccountInput) => r<void>('/v1/me', { method: 'DELETE', body: input }),
  },
  ai: {
    status: () => r<AiStatus>('/v1/ai/status'),
    settings: () => r<AiSettings>('/v1/ai/settings'),
    models: (input: ListModelsInput) =>
      r<AiModelInfo[]>('/v1/ai/models', { method: 'POST', body: input }),
    connectionModels: (id: string) => r<AiModelInfo[]>(`/v1/ai/connections/${enc(id)}/models`),
    createConnection: (input: CreateConnectionInput) =>
      r<AiConnection>('/v1/ai/connections', { method: 'POST', body: input }),
    updateConnection: (id: string, input: UpdateConnectionInput) =>
      r<AiConnection>(`/v1/ai/connections/${enc(id)}`, { method: 'PATCH', body: input }),
    removeConnection: (id: string) =>
      r<void>(`/v1/ai/connections/${enc(id)}`, { method: 'DELETE' }),
    setActive: (input: SetActiveAiInput) =>
      r<AiSettings>('/v1/ai/active', { method: 'PUT', body: input }),
    transcribe: (audio: Blob) => upload<{ text: string }>('/v1/ai/transcribe', audio),
  },
  learnings: {
    list: () => r<LearningSummary[]>('/v1/learnings'),
    get: (id: string) => r<LearningDetail>(`/v1/learnings/${enc(id)}`),
    create: (input: CreateLearningInput) =>
      r<LearningDetail>('/v1/learnings', { method: 'POST', body: input }),
    update: (id: string, input: UpdateLearningInput) =>
      r<LearningDetail>(`/v1/learnings/${enc(id)}`, { method: 'PATCH', body: input }),
    remove: (id: string) => r<void>(`/v1/learnings/${enc(id)}`, { method: 'DELETE' }),
    regenerateOptions: (id: string) =>
      r<LearningDetail>(`/v1/learnings/${enc(id)}/options`, { method: 'POST' }),
    build: (id: string, preferences: LearningPreferences) =>
      r<LearningDetail>(`/v1/learnings/${enc(id)}/build`, {
        method: 'POST',
        body: { preferences },
      }),
    undo: (id: string) => r<LearningDetail>(`/v1/learnings/${enc(id)}/undo`, { method: 'POST' }),
    step: (id: string, stepId: string) =>
      r<StepDetail>(`/v1/learnings/${enc(id)}/steps/${enc(stepId)}`),
    setStepStatus: (id: string, stepId: string, status: StepStatus) =>
      r<StepDetail>(`/v1/learnings/${enc(id)}/steps/${enc(stepId)}`, {
        method: 'PATCH',
        body: { status },
      }),
    lesson: (id: string, stepId: string, instruction?: string) =>
      r<StepDetail>(`/v1/learnings/${enc(id)}/steps/${enc(stepId)}/lesson`, {
        method: 'POST',
        body: instruction ? { instruction } : {},
      }),
    lessonStream: (
      id: string,
      stepId: string,
      instruction: string | undefined,
      h: StreamHandlers,
    ) =>
      stream<StepDetail>(
        `/v1/learnings/${enc(id)}/steps/${enc(stepId)}/lesson/stream`,
        instruction ? { instruction } : {},
        h,
      ),
    slides: (id: string, stepId: string) =>
      r<StepDetail>(`/v1/learnings/${enc(id)}/steps/${enc(stepId)}/slides`, { method: 'POST' }),
    games: (id: string, stepId: string) =>
      r<StepDetail>(`/v1/learnings/${enc(id)}/steps/${enc(stepId)}/games`, { method: 'POST' }),
    gameResult: (id: string, stepId: string, score: number) =>
      r<void>(`/v1/learnings/${enc(id)}/steps/${enc(stepId)}/games/result`, {
        method: 'POST',
        body: { score },
      }),
    history: (id: string) => r<HistoryEntry[]>(`/v1/learnings/${enc(id)}/history`),
    openConversation: (id: string, kind: ConversationKind, stepId?: string) =>
      r<Conversation>(`/v1/learnings/${enc(id)}/conversations`, {
        method: 'POST',
        body: { kind, ...(stepId ? { stepId } : {}) },
      }),
    assessments: (id: string) => r<AssessmentSummary[]>(`/v1/learnings/${enc(id)}/assessments`),
    createAssessment: (id: string, input: CreateAssessmentInput) =>
      r<AssessmentDetail>(`/v1/learnings/${enc(id)}/assessments`, { method: 'POST', body: input }),
    createAssessmentStream: (id: string, input: CreateAssessmentInput, h: StreamHandlers) =>
      stream<AssessmentDetail>(`/v1/learnings/${enc(id)}/assessments/stream`, input, h),
  },
  conversations: {
    get: (id: string) => r<Conversation>(`/v1/conversations/${enc(id)}`),
    send: (id: string, content: string) =>
      r<SendMessageResult>(`/v1/conversations/${enc(id)}/messages`, {
        method: 'POST',
        body: { content },
      }),
    opening: (id: string) =>
      r<SendMessageResult>(`/v1/conversations/${enc(id)}/opening`, { method: 'POST' }),
    sendStream: (id: string, content: string, h: StreamHandlers) =>
      stream<SendMessageResult>(`/v1/conversations/${enc(id)}/messages/stream`, { content }, h),
    openingStream: (id: string, h: StreamHandlers) =>
      stream<SendMessageResult>(`/v1/conversations/${enc(id)}/opening/stream`, {}, h),
    restart: (id: string) =>
      r<Conversation>(`/v1/conversations/${enc(id)}/restart`, { method: 'POST' }),
  },
  guide: {
    ask: (input: GuideRequest, h: StreamHandlers) =>
      stream<{ reply: string }>('/v1/guide/stream', input, h),
  },
  progress: {
    get: () =>
      r<LearnerProgress>('/v1/me/progress', {
        query: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
      }),
  },
  assessments: {
    get: (id: string) => r<AssessmentDetail>(`/v1/assessments/${enc(id)}`),
    save: (id: string, answers: Record<string, string>) =>
      r<AssessmentDetail>(`/v1/assessments/${enc(id)}/answers`, {
        method: 'PUT',
        body: { answers },
      }),
    submit: (id: string, answers: Record<string, string>) =>
      r<AssessmentDetail>(`/v1/assessments/${enc(id)}/submit`, {
        method: 'POST',
        body: { answers },
      }),
    finish: (id: string) =>
      r<AssessmentDetail>(`/v1/assessments/${enc(id)}/finish`, { method: 'POST' }),
    remove: (id: string) => r<void>(`/v1/assessments/${enc(id)}`, { method: 'DELETE' }),
  },
};
