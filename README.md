# StudyThinker

Learn anything, your way. Type a topic (and, if you like, a few words about you).
The AI proposes how to learn it — how long, the shape of the journey, the ways of
learning and of being assessed, the teacher — with a sensible default for each.
You change whatever you want, and the journey is built from your choices. A coach
chat in every learning answers questions and **changes the plan when you ask**.

The same app works for a child in primary school, a PhD researcher or a retiree:
nothing is fixed; everything is shaped by the learner.

## What you can choose

|                        | Options (the AI suggests the best ones for each topic)                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Who**                | child, pre-teen, teen, adult, professional, academic, older learner · starting level                                                                                                                               |
| **Time**               | total length, minutes per session, sessions per week                                                                                                                                                               |
| **Journey shape** (12) | step-by-step path, ladder, tree, clusters, mind map, week by week, spiral, quest map, project-based, chapters, board, concept web                                                                                  |
| **Ways of learning**   | reading, chat, **voice lessons**, debate, practice, stories, question-led, pictures and diagrams, narrated slideshows, face-to-face teacher, games (memory cards, word search, sorting, sequence, fact or fiction) |
| **Assessment**         | quiz, written, practical task, scenarios, spoken answers, debate with the AI, flashcards, picture/diagram questions, interactive challenges, spoken presentation                                                   |
| **Teacher**            | 6 personalities · a voice from your device (speed, pitch) · a face you design, animated while it talks                                                                                                             |
| **Topic-specific**     | extra questions the AI invents for the topic (e.g. guitar style, language dialect)                                                                                                                                 |
| **Your own ideas**     | free text — the AI follows it                                                                                                                                                                                      |

## Keeping learners engaged

- **You see what the AI is doing:** its choices and the journey's steps appear live as it
  writes them; lessons and replies stream word by word; the teacher starts speaking with
  the first sentence.
- **Motivation from real activity:** XP, levels, daily streaks, a weekly goal, 14 badges,
  celebrations, a "continue where you left off" card, "you are here" and "just changed"
  markers on the journey, and a history of everything that happened.

## AI models

- **Built-in:** open models on Hugging Face (DeepSeek, gpt-oss, GLM, Qwen, Llama —
  configurable), used when the server has an `HF_TOKEN`.
- **Your own key:** Settings → AI → pick a provider (Hugging Face, OpenAI, Anthropic,
  Google Gemini, Groq, OpenRouter, Mistral, DeepSeek, Together, or any
  OpenAI-compatible server) and paste a key. The server lists that key's models,
  drops ones that can't chat, ranks the rest, and **sends each of the best 12 a tiny
  test message** — only models that answered are offered (the best is pre-picked and
  the list is saved with the key; "check again" refreshes it). Each check costs a few
  tokens on that key.
- **Hugging Face keys need no model choice:** the server uses its curated list
  (`HF_MODELS`), keeps the ones that answer, and automatically moves to the next one if
  a model disappears or goes down (and remembers the switch).
- Keys are encrypted (AES-256-GCM) and never sent back to the browser. Errors name the
  provider and the real reason (key rejected, no credit, quota used up, rate limited…).

> Hugging Face Inference Providers is pay-as-you-go: the built-in models are free
> for learners, but usage is billed to the `HF_TOKEN` account (free HF accounts
> need prepaid credits; PRO includes $2/month).

Voice: the teacher speaks with your device's voices (free, offline). Spoken
answers are transcribed with Whisper on Hugging Face (or OpenAI) when available,
otherwise by the browser.

Pictures: diagrams are drawn in the browser from text the AI writes (Mermaid);
photos come from Wikimedia Commons (free licences, credited on the page). Only the
search term is sent to Wikimedia.

## Architecture

```
apps/web      Next.js 16 — landing, sign-in, learnings, 3D journey worlds, lessons, voice, assessments, settings
apps/api      NestJS 12 + Prisma 7 + Postgres — accounts, learnings, all AI calls
packages/shared  zod contracts and the catalogs (shapes, modes, assessments, providers)
```

## Run it locally

Needs Node ≥ 22.12, pnpm 10 and Postgres 16+ (Docker or a local install).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env          # set JWT_ACCESS_SECRET, AI_KEYS_SECRET, DATABASE_URL, optional HF_TOKEN
cp apps/web/.env.example apps/web/.env.local
pnpm infra:up                                   # Postgres in Docker (or point DATABASE_URL at your own)
pnpm --filter @studythinker/shared build
pnpm db:deploy
pnpm dev                                        # web on :3000, api on :4000
```

Or everything in Docker: `pnpm stack:up`.

## Tests

| Command                                              | What                                                                                                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint` · `pnpm typecheck` · `pnpm format:check` | all workspaces                                                                                                                                                                    |
| `pnpm test`                                          | unit tests (shared catalogs, AI adapters, key encryption, output normalisation, web)                                                                                              |
| `pnpm --filter api test:e2e`                         | the whole flow on a real database with a scripted AI provider: connect a key, options, build, lesson, voice, coach changes + undo, rebuild, quiz, debate, privacy, export, delete |

No test calls a paid model. See [docs/roadmap.md](docs/roadmap.md) for what's next.
