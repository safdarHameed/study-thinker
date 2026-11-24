# StudyThinker — web

The StudyThinker learner app: Next.js 16 (App Router, Cache Components), React 19,
Tailwind CSS v4, shadcn/ui (Radix), TanStack Query, react-hook-form + zod.
API contracts and types come from `@studythinker/shared`.

## Getting started

```bash
# from the repo root
pnpm install
pnpm --filter @studythinker/shared build
cp apps/web/.env.example apps/web/.env.local   # adjust NEXT_PUBLIC_API_URL if needed
pnpm --filter web dev                          # http://localhost:3000
```

The app expects the API at `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`).
If the API is down, pages show a clear “can’t reach StudyThinker” state with a retry.

## Scripts

| Script      | What it does                              |
| ----------- | ----------------------------------------- |
| `dev`       | Dev server on port 3000                   |
| `build`     | Production build (`output: 'standalone'`) |
| `start`     | Serve the production build on port 3000   |
| `lint`      | ESLint                                    |
| `typecheck` | Generate route types, then `tsc --noEmit` |
| `test`      | Vitest + Testing Library                  |

## Structure

```
src/
  app/                 routes: (marketing) landing, (auth) sign-in pages,
                       (app) learnings, steps, assessments, settings
  components/
    ui/                shadcn primitives
    common/            ErrorState, LoadingState, Markdown, SectionCard…
    shell/             app header, auth guard, user menu
    learnings/         new learning, options screen, 12 journey views, step page,
                       chat panel (coach/tutor/debate), voice lesson
    assessments/       taking and reviewing assessments
    settings/          AI models (built-in or own key), account
  lib/
    api/               typed fetch client (envelopes, ApiError, refresh-on-401)
    auth/              in-memory access token + session restore
    queries.ts         TanStack Query hooks
    speech.ts          teacher voice (browser speech) and dictation (server Whisper or browser)
  proxy.ts             redirect UX based on the non-sensitive `lw_session` cookie
```

## Auth model

The access token lives in memory only. On load the app calls `POST /v1/auth/refresh`
(the httpOnly `lw_refresh` cookie is sent with `credentials: 'include'`). A 401 triggers
one shared refresh and a retry; if that fails the learner is sent to `/login`.
`proxy.ts` only improves redirects — the API enforces auth.

## Design system

Tokens live in `src/app/globals.css` (`@theme inline`): warm paper surfaces, evergreen
primary, apricot highlight, sage and clay supporting tones, warm-charcoal dark mode.
Type pairs Fraunces (display) with Inter (UI/body); Atkinson Hyperlegible is used when
the learner turns on the reading-friendly font. Accessibility preferences from the
profile (font scale, readable font, high contrast, reduced motion) are applied to
`<html>` as data attributes and a `--font-scale` variable.

Features planned for later phases are shown with the `PlannedFeature` / `PlannedBadge`
components and never simulate behaviour.

## Docker

```bash
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 .
```

Built from the monorepo root; `Dockerfile.dockerignore` keeps the context small.
