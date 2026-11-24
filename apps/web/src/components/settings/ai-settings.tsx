'use client';

import {
  AI_PROVIDERS,
  type AiModelInfo,
  type AiProviderId,
  type AiSettings,
  providerPicksModel,
  isLocalProvider,
  LOCAL_KEY,
} from '@studythinker/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Check,
  ExternalLink,
  KeyRound,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Spinner } from '@/components/common/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Picker } from '@/components/ui/picker';
import { api, describeError } from '@/lib/api';
import { keys, useAiSettings } from '@/lib/queries';
import { cn } from '@/lib/utils';

export function AiSettingsSection() {
  const settings = useAiSettings();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const apply = (s: AiSettings) => {
    qc.setQueryData(keys.aiSettings, s);
    void qc.invalidateQueries({ queryKey: keys.aiStatus });
  };
  const refresh = () => void qc.invalidateQueries({ queryKey: ['ai'] });

  if (settings.isPending) return <Spinner />;
  if (settings.isError)
    return <p className="text-sm text-destructive">{describeError(settings.error).description}</p>;
  const s = settings.data;

  async function choose(connectionId: string | null, freeModel?: string) {
    try {
      apply(await api.ai.setActive({ connectionId, freeModel }));
    } catch (err) {
      toast.error(describeError(err).description);
    }
  }

  return (
    <div className="space-y-4">
      {/* Built-in models */}
      <div
        className={cn(
          'rounded-xl border p-4',
          s.activeConnectionId === null && s.builtInAvailable
            ? 'border-primary bg-primary/[0.05]'
            : 'border-border',
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-lg bg-[linear-gradient(135deg,#FFD21E,#FF9D00)] text-lg"
            aria-hidden
          >
            🤗
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Built-in · free</p>
            {!s.builtInAvailable && (
              <p className="text-sm text-muted-foreground">Unavailable here — add a key.</p>
            )}
          </div>
          {s.builtInAvailable && s.activeConnectionId === null && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              <Check className="size-4" aria-hidden /> In use
            </span>
          )}
        </div>
        {s.builtInAvailable && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="flex flex-1 items-center gap-1.5 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-primary" aria-hidden />
              Best model picked for you · {s.builtInModel.split('/').pop()}
            </p>
            {s.activeConnectionId !== null && (
              <Button size="sm" variant="outline" onClick={() => void choose(null)}>
                Use built-in
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Own connections */}
      {s.connections.map((c) => (
        <ConnectionRow
          key={c.id}
          connection={c}
          active={s.activeConnectionId === c.id}
          onUse={() => void choose(c.id)}
          onChanged={refresh}
        />
      ))}

      {adding ? (
        <AddConnection
          local={s.localClaudeCode}
          onDone={() => {
            setAdding(false);
            refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus aria-hidden /> Add API key
        </Button>
      )}
      <p className="text-xs text-muted-foreground">Keys are encrypted and never shown again.</p>
    </div>
  );
}

function ConnectionRow({
  connection: c,
  active,
  onUse,
  onChanged,
}: {
  connection: AiSettings['connections'][number];
  active: boolean;
  onUse: () => void;
  onChanged: () => void;
}) {
  const [models, setModels] = useState<AiModelInfo[]>(c.models);
  const [checking, setChecking] = useState(false);
  const [picking, setPicking] = useState(false);
  const provider = AI_PROVIDERS.find((p) => p.id === c.provider);

  async function checkAgain() {
    setChecking(true);
    try {
      const list = await api.ai.connectionModels(c.id);
      setModels(list);
      toast.success(`${list.length} model${list.length === 1 ? '' : 's'} working with this key`);
      onChanged();
    } catch (err) {
      toast.error(describeError(err).description);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        active ? 'border-primary bg-primary/[0.05]' : 'border-border',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {c.label}{' '}
            {!isLocalProvider(c.provider) && (
              <span className="font-normal text-muted-foreground">· {c.keyHint}</span>
            )}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {c.automatic ? (
              <>
                <Sparkles className="mr-1 inline size-3.5 text-primary" aria-hidden />
                Best model picked for you · {shortId(c.model)}
              </>
            ) : (
              <>
                {provider?.label ?? c.provider} · {shortId(c.model)}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {active ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              <Check className="size-4" aria-hidden /> In use
            </span>
          ) : (
            <Button size="sm" onClick={onUse}>
              Use this
            </Button>
          )}
          {!c.automatic && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setPicking((v) => !v)}
              aria-label="Change model"
              title="Change model"
            >
              <Bot />
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => void checkAgain()}
            disabled={checking}
            aria-label="Check models again"
            title="Check which models work now"
          >
            {checking ? <Spinner className="size-4" /> : <RefreshCw />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove ${c.label}`}
            onClick={async () => {
              try {
                await api.ai.removeConnection(c.id);
                onChanged();
              } catch (err) {
                toast.error(describeError(err).description);
              }
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {checking && <Checking provider={provider?.label ?? 'the provider'} />}
      {picking && !c.automatic && (
        <div className="mt-3">
          <ModelSelect
            models={models}
            value={c.model}
            onChange={async (model) => {
              try {
                await api.ai.updateConnection(c.id, { model });
                setPicking(false);
                onChanged();
                toast.success(`Now using ${shortId(model)}`);
              } catch (err) {
                toast.error(describeError(err).description);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

function shortId(id: string) {
  return (
    id
      .replace(/^models\//, '')
      .split('/')
      .pop() ?? id
  );
}

function modelOptions(models: AiModelInfo[]) {
  return models.map((m) => ({
    value: m.id,
    label: m.label !== m.id ? m.label : shortId(m.id),
    text: `${m.label} ${m.id}`,
    description: m.recommended ? 'Recommended' : undefined,
    icon: m.recommended ? (
      <Sparkles className="text-primary" />
    ) : (
      <Check className="text-success" />
    ),
  }));
}

function ModelSelect({
  models,
  value,
  onChange,
}: {
  models: AiModelInfo[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Picker
      aria-label="Model"
      value={value}
      onValueChange={onChange}
      options={modelOptions(models)}
      searchable={models.length > 8}
      icon={<Bot />}
      placeholder="Choose a model"
      searchPlaceholder={`Search ${models.length} models`}
    />
  );
}

/** Shown while the server test-calls models — this takes a few seconds. */
function Checking({ provider }: { provider: string }) {
  return (
    <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner className="size-4" />
      Testing which {provider} models answer…
    </p>
  );
}

function AddConnection({
  local,
  onDone,
  onCancel,
}: {
  /** The server offers Claude Code on its own computer (development only). */
  local: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [provider, setProvider] = useState<AiProviderId>('huggingface');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [models, setModels] = useState<AiModelInfo[] | null>(null);
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState<'models' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const info = AI_PROVIDERS.find((p) => p.id === provider)!;
  const automatic = providerPicksModel(provider);
  const keyless = isLocalProvider(provider);
  const key = keyless ? LOCAL_KEY : apiKey;
  const providers = AI_PROVIDERS.filter((p) => local || !isLocalProvider(p.id));

  async function loadModels() {
    setBusy('models');
    setError(null);
    try {
      const list = await api.ai.models({ provider, apiKey: key, baseUrl: baseUrl || undefined });
      setModels(list);
      setModel((list.find((m) => m.recommended) ?? list[0])?.id ?? '');
    } catch (err) {
      setError(describeError(err).description);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy('save');
    setError(null);
    try {
      const conn = await api.ai.createConnection({
        provider,
        apiKey: key,
        baseUrl: baseUrl || undefined,
        model: automatic ? undefined : model,
      });
      toast.success(`Connected · using ${shortId(conn.model)}`);
      onDone();
    } catch (err) {
      setError(describeError(err).description);
    } finally {
      setBusy(null);
    }
  }

  const ready = !!key.trim() && busy === null && (provider !== 'custom' || !!baseUrl);

  return (
    <div className="space-y-4 rounded-xl border border-primary/40 p-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Provider">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={provider === p.id}
            onClick={() => {
              setProvider(p.id);
              setModels(null);
              setError(null);
            }}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium',
              provider === p.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-primary/40',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {provider === 'custom' && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Server URL</span>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://my-server.example/v1"
          />
        </label>
      )}
      {keyless ? (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          Uses Claude Code signed in on this computer. For your own testing only.
        </p>
      ) : (
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between text-sm font-medium">
            API key
            {info.keyUrl && (
              <a
                href={info.keyUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-xs font-normal text-primary hover:underline"
              >
                Get a key <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </span>
          <Input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setModels(null);
            }}
            placeholder={info.keyHint || 'Paste your key'}
          />
        </label>
      )}
      {automatic ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-primary" aria-hidden />
            We pick good chat models for you and switch if one is down.
          </p>
          <Button onClick={() => void save()} disabled={!ready}>
            {busy === 'save' ? (
              <Spinner className="size-4 border-white/40 border-t-white" />
            ) : (
              <Check aria-hidden />
            )}
            {busy === 'save' ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      ) : !models ? (
        <Button onClick={() => void loadModels()} disabled={!ready}>
          {busy === 'models' ? (
            <Spinner className="size-4 border-white/40 border-t-white" />
          ) : (
            <Sparkles aria-hidden />
          )}
          Find working models
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <Check className="mr-1 inline size-4 text-success" aria-hidden />
            {models.length} model{models.length === 1 ? '' : 's'} answered a test with this key
          </p>
          <ModelSelect models={models} value={model} onChange={setModel} />
          <Button onClick={() => void save()} disabled={!model || busy !== null}>
            {busy === 'save' ? (
              <Spinner className="size-4 border-white/40 border-t-white" />
            ) : (
              <Check aria-hidden />
            )}
            {busy === 'save' ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      )}
      {(busy === 'models' || (busy === 'save' && automatic)) && <Checking provider={info.label} />}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
