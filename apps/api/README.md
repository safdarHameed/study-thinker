# StudyThinker API (`apps/api`)

NestJS 12 (ESM) + Prisma 7 + Postgres. Owns accounts, learnings, and every AI call
(no separate AI server).

```bash
pnpm --filter api dev        # watch mode on :4000 (Swagger at /docs)
pnpm --filter api test       # unit tests
pnpm --filter api test:e2e   # the full learner flow against Postgres, with a scripted AI provider
pnpm --filter api lint && pnpm --filter api typecheck
```

## Layout

```
src/
  config/       zod-validated environment (fails fast at start-up)
  prisma/       PrismaService
  common/       auth guard + decorators, error envelope, request id/logging, throttling
  modules/
    auth/       register, login, refresh rotation, password reset/change
    account/    profile name, export, delete
    ai/         providers (OpenAI-compatible + Anthropic), model lists, encrypted keys,
                built-in Hugging Face models, speech-to-text
    learnings/  learnings, AI options, journey building, lessons, chats (coach, tutor,
                voice, debate), assessments and marking, undo
    system/     /health
test/           end-to-end flow + the scripted provider it uses
```

## How AI is used

`AiService` picks the model for each learner: their own connection if they chose
one, otherwise the built-in Hugging Face models (`HF_TOKEN`). Prompts live in
`modules/learnings/prompts.ts`; model output is parsed leniently and normalised
(`normalize.ts`) so a slightly-off answer still works, and invalid JSON gets one
repair attempt.
