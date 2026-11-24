/**
 * The whole learner flow through the real API and database, with a scripted
 * model provider (no paid AI). Needs DATABASE_URL pointing at a migrated database.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AppConfig } from '../src/config/app-config.service.js';
import { configureApp } from '../src/setup.js';
import { FAKE_KEY, startFakeProvider } from './fake-provider.js';

let app: NestExpressApplication;
let fake: Awaited<ReturnType<typeof startFakeProvider>>;
const http = () => request(app.getHttpServer());

async function signUp(name: string) {
  const res = await http()
    .post('/v1/auth/register')
    .send({
      email: `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.invalid`,
      password: 'a-good-password-1',
      displayName: name,
    })
    .expect(201);
  return `Bearer ${res.body.data.tokens.accessToken as string}`;
}

async function waitForReady(auth: string, id: string) {
  for (let i = 0; i < 50; i++) {
    const res = await http().get(`/v1/learnings/${id}`).set('authorization', auth).expect(200);
    if (res.body.data.status !== 'BUILDING' && !res.body.data.live) return res.body.data;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Journey never finished building');
}

beforeAll(async () => {
  fake = await startFakeProvider();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, app.get(AppConfig));
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await fake?.close();
});

describe('learning flow', () => {
  let auth: string;
  let learningId: string;
  let prefs: Record<string, unknown>;

  it('connects the learner’s own provider after checking the key', async () => {
    auth = await signUp('learner');
    await http()
      .post('/v1/ai/models')
      .set('authorization', auth)
      .send({ provider: 'custom', apiKey: 'wrong', baseUrl: fake.baseUrl })
      .expect(503)
      .expect((r) => expect(r.body.error.details.reason).toBe('auth'));
    const models = await http()
      .post('/v1/ai/models')
      .set('authorization', auth)
      .send({ provider: 'custom', apiKey: FAKE_KEY, baseUrl: fake.baseUrl })
      .expect(200);
    // Only models that answered a test message are offered; the best is marked.
    expect(models.body.data).toEqual([
      { id: 'fake-model', label: 'fake-model', recommended: true },
    ]);
    await http()
      .post('/v1/ai/connections')
      .set('authorization', auth)
      .send({ provider: 'custom', apiKey: FAKE_KEY, baseUrl: fake.baseUrl, model: 'broken-model' })
      .expect(503)
      .expect((r) => {
        expect(r.body.error.details.reason).toBe('bad_model');
        expect(r.body.error.message).toContain('doesn’t work with your');
      });
    const conn = await http()
      .post('/v1/ai/connections')
      .set('authorization', auth)
      .send({ provider: 'custom', apiKey: FAKE_KEY, baseUrl: fake.baseUrl, model: 'fake-model' })
      .expect(201);
    expect(JSON.stringify(conn.body)).not.toContain(FAKE_KEY);
    expect(conn.body.data).toMatchObject({ automatic: false, models: [{ id: 'fake-model' }] });
    const status = await http().get('/v1/ai/status').set('authorization', auth).expect(200);
    expect(status.body.data).toMatchObject({
      available: true,
      source: 'own-key',
      model: 'fake-model',
    });
  });

  it('creates a learning with AI options, keeping only available choices', async () => {
    const res = await http()
      .post('/v1/learnings')
      .set('authorization', auth)
      .send({ topic: 'Guitar' })
      .expect(201);
    learningId = res.body.data.id;
    // Options are prepared in the background while the learner watches.
    expect(res.body.data.live).toMatchObject({ phase: 'options', model: 'fake-model' });
    const l = await waitForReady(auth, learningId);
    expect(l.live).toBeNull();
    expect(l.status).toBe('DRAFT');
    expect(l.options.structures[0].id).toBe('quest');
    expect(l.options.defaultModes).toEqual(['practice', 'reading']); // unknown modes are dropped
    prefs = {
      audience: 'adult',
      level: 'new',
      duration: { amount: 6, unit: 'weeks' },
      minutesPerSession: 20,
      sessionsPerWeek: 4,
      structure: 'quest',
      modes: ['reading', 'voice'],
      theoryPractice: 80,
      assessments: ['quiz'],
      teacher: 'friendly',
      voice: { voiceURI: null, rate: 1, pitch: 1 },
      language: 'English',
      extras: { style: ['Rock'] },
      notes: 'Use rock songs',
    };
  });

  it('builds the journey in the background from the learner’s choices', async () => {
    await http()
      .post(`/v1/learnings/${learningId}/build`)
      .set('authorization', auth)
      .send({ preferences: prefs })
      .expect(201);
    const l = await waitForReady(auth, learningId);
    expect(l.status).toBe('READY');
    expect(l.steps).toHaveLength(6);
    expect(l.steps[2]).toMatchObject({ kind: 'assessment', assessmentStyle: 'quiz' });
    const prompt = fake.calls.find((c) =>
      c.system.includes('Design a complete learning journey'),
    )!.system;
    expect(prompt).toContain('Quest map');
    expect(prompt).toContain('Rock');
    expect(prompt).toContain('Use rock songs');
  });

  it('writes a lesson and starts a voice lesson for a step', async () => {
    const l = await waitForReady(auth, learningId);
    const stepId = l.steps[0].id;
    const lesson = await http()
      .post(`/v1/learnings/${learningId}/steps/${stepId}/lesson`)
      .set('authorization', auth)
      .send({})
      .expect(201);
    expect(lesson.body.data.lesson.keyPoints).toEqual(['Relax', 'Practise daily']);
    expect(lesson.body.data.step.status).toBe('in_progress');
    const conv = await http()
      .post(`/v1/learnings/${learningId}/conversations`)
      .set('authorization', auth)
      .send({ kind: 'voice', stepId })
      .expect(201);
    const opening = await http()
      .post(`/v1/conversations/${conv.body.data.id}/opening`)
      .set('authorization', auth)
      .expect(201);
    expect(opening.body.data.message.content).toContain('Which leg');
    await http()
      .post(`/v1/conversations/${conv.body.data.id}/opening`)
      .set('authorization', auth)
      .expect(409);
  });

  it('lets the coach change the journey, skipping unknown actions, and undo it', async () => {
    const coach = await http()
      .post(`/v1/learnings/${learningId}/conversations`)
      .set('authorization', auth)
      .send({ kind: 'coach' })
      .expect(201);
    const reply = await http()
      .post(`/v1/conversations/${coach.body.data.id}/messages`)
      .set('authorization', auth)
      .send({ content: 'please add strumming' })
      .expect(201);
    expect(reply.body.data.learningChanged).toBe(true);
    expect(reply.body.data.message.changes).toEqual([
      'Added "Strumming"',
      'Renamed to "My guitar quest"',
    ]);
    let l = await waitForReady(auth, learningId);
    expect(l.title).toBe('My guitar quest');
    expect(l.steps.map((s: { key: string }) => s.key).slice(0, 3)).toEqual([
      'w1-1',
      'strum',
      'w1-2',
    ]);
    const undone = await http()
      .post(`/v1/learnings/${learningId}/undo`)
      .set('authorization', auth)
      .expect(201);
    l = undone.body.data;
    expect(l.steps.map((s: { key: string }) => s.key)).not.toContain('strum');
    expect(l.steps[0].hasLesson).toBe(true);
  });

  it('rebuilds on request while keeping started steps', async () => {
    const coach = await http()
      .post(`/v1/learnings/${learningId}/conversations`)
      .set('authorization', auth)
      .send({ kind: 'coach' })
      .expect(201);
    await http()
      .post(`/v1/conversations/${coach.body.data.id}/messages`)
      .set('authorization', auth)
      .send({ content: 'make it shorter' })
      .expect(201);
    const l = await waitForReady(auth, learningId);
    expect(l.preferences.duration).toEqual({ amount: 2, unit: 'weeks' });
    expect(l.steps[0]).toMatchObject({ key: 'w1-1', status: 'in_progress', hasLesson: true });
  });

  it('marks a quiz exactly, hides answers before marking, and completes the step on a pass', async () => {
    const l = await waitForReady(auth, learningId);
    const boss = l.steps.find((s: { kind: string }) => s.kind === 'assessment');
    const created = await http()
      .post(`/v1/learnings/${learningId}/assessments`)
      .set('authorization', auth)
      .send({ stepId: boss.id })
      .expect(201);
    const a = created.body.data;
    expect(a.questions).toHaveLength(2); // the one-option question was dropped
    expect(JSON.stringify(a.questions)).not.toMatch(/"answer"|explanation/);
    const graded = await http()
      .post(`/v1/assessments/${a.id}/submit`)
      .set('authorization', auth)
      .send({ answers: { q1: '1', q2: '0' } })
      .expect(201);
    expect(graded.body.data).toMatchObject({ status: 'graded', score: 100 });
    expect(graded.body.data.result.questions[1].correctAnswer).toBe('Left');
    const step = await http()
      .get(`/v1/learnings/${learningId}/steps/${boss.id}`)
      .set('authorization', auth)
      .expect(200);
    expect(step.body.data.step.status).toBe('done');
    await http()
      .post(`/v1/assessments/${a.id}/submit`)
      .set('authorization', auth)
      .send({ answers: {} })
      .expect(409);
  });

  it('streams replies and lessons as they are written, without reasoning blocks', async () => {
    const l = await waitForReady(auth, learningId);
    const stepId = l.steps[1].id;
    const events = (text: string) =>
      text
        .split('\n\n')
        .filter((b) => b.startsWith('data: '))
        .map((b) => JSON.parse(b.slice(6)) as { type: string; text?: string; result?: any });
    const lesson = await http()
      .post(`/v1/learnings/${learningId}/steps/${stepId}/lesson/stream`)
      .set('authorization', auth)
      .send({ instruction: 'simpler' })
      .buffer(true)
      .parse((res, cb) => {
        let body = '';
        res.on('data', (c: Buffer) => (body += c.toString()));
        res.on('end', () => cb(null, body));
      })
      .expect(200)
      .expect('content-type', /text\/event-stream/);
    const lessonEvents = events(lesson.body as string);
    const streamed = lessonEvents
      .filter((e) => e.type === 'delta')
      .map((e) => e.text)
      .join('');
    expect(streamed).not.toContain('think');
    expect(streamed).toContain('# Holding the guitar');
    const done = lessonEvents.at(-1)!;
    expect(done.type).toBe('done');
    expect(done.result.lesson.keyPoints).toEqual(['Relax', 'Practise daily']);

    const coach = await http()
      .post(`/v1/learnings/${learningId}/conversations`)
      .set('authorization', auth)
      .send({ kind: 'coach' })
      .expect(201);
    const reply = await http()
      .post(`/v1/conversations/${coach.body.data.id}/messages/stream`)
      .set('authorization', auth)
      .send({ content: 'hello there' })
      .buffer(true)
      .parse((res, cb) => {
        let body = '';
        res.on('data', (c: Buffer) => (body += c.toString()));
        res.on('end', () => cb(null, body));
      })
      .expect(200);
    const replyEvents = events(reply.body as string);
    // Only the coach's `reply` text is streamed, not its JSON.
    expect(
      replyEvents
        .filter((e) => e.type === 'delta')
        .map((e) => e.text)
        .join(''),
    ).toBe('Happy to help!');
    expect(replyEvents.at(-1)!.result.message.content).toBe('Happy to help!');

    // Errors before streaming starts are normal HTTP errors.
    await http()
      .post(`/v1/conversations/00000000-0000-7000-8000-000000000000/messages/stream`)
      .set('authorization', auth)
      .send({ content: 'hi' })
      .expect(404);
  });

  it('rewards real activity with XP, a streak, badges and a history', async () => {
    const p = await http()
      .get('/v1/me/progress?tz=Europe/London')
      .set('authorization', auth)
      .expect(200);
    const progress = p.body.data;
    // created (5) + journey (10) + 2 lessons (10) + passed check-in step (20) + quiz 100 (30).
    // The teacher opening a voice lesson isn't the learner's activity, so no XP.
    expect(progress.xp).toBe(75);
    expect(progress.level).toBe(1);
    expect(progress.streak).toBe(1);
    expect(progress.learnedToday).toBe(true);
    expect(progress.weekGoal).toBe(4);
    const earned = progress.badges.filter((b: { earnedAt: string | null }) => b.earnedAt);
    expect(earned.map((b: { id: string }) => b.id).sort()).toEqual(
      ['first-step', 'perfect', 'tested'].sort(),
    );
    expect(progress.recent.map((r: { label: string }) => r.label)).toContain(
      'Scored 100 in "Quick quiz"',
    );

    // Marking the same step done again gives no extra XP.
    const l = await waitForReady(auth, learningId);
    const done = l.steps.find((s: { status: string }) => s.status === 'done');
    await http()
      .patch(`/v1/learnings/${learningId}/steps/${done.id}`)
      .set('authorization', auth)
      .send({ status: 'in_progress' })
      .expect(200);
    await http()
      .patch(`/v1/learnings/${learningId}/steps/${done.id}`)
      .set('authorization', auth)
      .send({ status: 'done' })
      .expect(200);
    const again = await http().get('/v1/me/progress').set('authorization', auth).expect(200);
    expect(again.body.data.xp).toBe(75);

    const history = await http()
      .get(`/v1/learnings/${learningId}/history`)
      .set('authorization', auth)
      .expect(200);
    const texts = history.body.data.map((h: { text: string }) => h.text);
    expect(texts).toContain('Changes from the coach');
    expect(texts.some((t: string) => t.startsWith('Got a 6-step journey'))).toBe(true);
  });

  it('runs a debate assessment and marks the transcript', async () => {
    const created = await http()
      .post(`/v1/learnings/${learningId}/assessments`)
      .set('authorization', auth)
      .send({ style: 'debate' })
      .expect(201);
    const a = created.body.data;
    expect(a.conversationId).toBeTruthy();
    await http().post(`/v1/assessments/${a.id}/finish`).set('authorization', auth).expect(400);
    await http()
      .post(`/v1/conversations/${a.conversationId}/messages`)
      .set('authorization', auth)
      .send({ content: 'Teachers give feedback.' })
      .expect(201);
    const graded = await http()
      .post(`/v1/assessments/${a.id}/finish`)
      .set('authorization', auth)
      .expect(201);
    expect(graded.body.data).toMatchObject({ status: 'graded', score: 70 });
    await http()
      .post(`/v1/conversations/${a.conversationId}/messages`)
      .set('authorization', auth)
      .send({ content: 'One more' })
      .expect(409);
  });

  it('refuses unknown assessment styles', async () => {
    await http()
      .post(`/v1/learnings/${learningId}/assessments`)
      .set('authorization', auth)
      .send({ style: 'telepathy' })
      .expect(400);
  });

  it('makes slides and games for a step, and rewards playing', async () => {
    const l = await waitForReady(auth, learningId);
    const stepId = l.steps[0].id;
    const slides = await http()
      .post(`/v1/learnings/${learningId}/steps/${stepId}/slides`)
      .set('authorization', auth)
      .expect(201);
    const s = slides.body.data.media.slides;
    expect(s).toHaveLength(2); // the empty slide was dropped
    expect(s[0].diagram).toBeUndefined(); // not a Mermaid diagram
    expect(s[1].diagram).toContain('flowchart');
    const games = await http()
      .post(`/v1/learnings/${learningId}/steps/${stepId}/games`)
      .set('authorization', auth)
      .expect(201);
    const g = games.body.data.media.games;
    expect(g.pairs).toHaveLength(3);
    expect(g.truths[0].answer).toBe(true);
    expect(g.groups).toEqual([
      { name: 'Parts', items: ['Neck', 'Body'] }, // the duplicate is dropped
      { name: 'Tools', items: ['Capo', 'Pick'] },
    ]); // the empty category is dropped
    expect(games.body.data.media.slides).toHaveLength(2); // kept
    const before = await http().get('/v1/me/progress').set('authorization', auth).expect(200);
    await http()
      .post(`/v1/learnings/${learningId}/steps/${stepId}/games/result`)
      .set('authorization', auth)
      .send({ score: 80 })
      .expect(204);
    const after = await http().get('/v1/me/progress').set('authorization', auth).expect(200);
    expect(after.body.data.xp - before.body.data.xp).toBe(13);
  });

  it('runs a simulation that offers choices', async () => {
    const l = await waitForReady(auth, learningId);
    const conv = await http()
      .post(`/v1/learnings/${learningId}/conversations`)
      .set('authorization', auth)
      .send({ kind: 'simulation', stepId: l.steps[0].id })
      .expect(201);
    const opening = await http()
      .post(`/v1/conversations/${conv.body.data.id}/opening`)
      .set('authorization', auth)
      .expect(201);
    expect(opening.body.data.message.content).toMatch(/^A\) Tune up$/m);
  });

  it('marks matching and ordering exactly, with partial credit', async () => {
    const created = await http()
      .post(`/v1/learnings/${learningId}/assessments`)
      .set('authorization', auth)
      .send({ style: 'interactive' })
      .expect(201);
    const a = created.body.data;
    expect(a.questions.map((q: { type: string }) => q.type)).toEqual(['match', 'order']);
    const match = a.questions[0];
    const order = a.questions[1];
    // Answer the match correctly using the shown (shuffled) right-hand side.
    const correct = ['1', '2', '3'].map((r) => match.right.indexOf(r));
    // Put the order fully right.
    const rightOrder = ['first', 'second', 'third'].map((x) => order.options.indexOf(x));
    expect(rightOrder).not.toEqual([0, 1, 2]); // shown shuffled
    const graded = await http()
      .post(`/v1/assessments/${a.id}/submit`)
      .set('authorization', auth)
      .send({ answers: { q1: JSON.stringify(correct), q2: JSON.stringify(rightOrder) } })
      .expect(201);
    expect(graded.body.data.score).toBe(100);
    expect(graded.body.data.result.questions[1].correctAnswer).toBe('first → second → third');
  });

  it('keeps every learner’s data private', async () => {
    const other = await signUp('other');
    const l = await waitForReady(auth, learningId);
    const assessments = await http()
      .get(`/v1/learnings/${learningId}/assessments`)
      .set('authorization', auth)
      .expect(200);
    const coach = await http()
      .post(`/v1/learnings/${learningId}/conversations`)
      .set('authorization', auth)
      .send({ kind: 'coach' })
      .expect(201);
    for (const path of [
      `/v1/learnings/${learningId}`,
      `/v1/learnings/${learningId}/steps/${l.steps[0].id}`,
      `/v1/assessments/${assessments.body.data[0].id}`,
      `/v1/conversations/${coach.body.data.id}`,
    ]) {
      await http().get(path).set('authorization', other).expect(404);
    }
    await http()
      .post(`/v1/conversations/${coach.body.data.id}/messages`)
      .set('authorization', other)
      .send({ content: 'hi' })
      .expect(404);
    await http().delete(`/v1/learnings/${learningId}`).set('authorization', other).expect(404);
    const list = await http().get('/v1/learnings').set('authorization', other).expect(200);
    expect(list.body.data).toEqual([]);
  });

  it('tells a learner without any model what to do', async () => {
    const fresh = await signUp('nomodel');
    const status = await http().get('/v1/ai/status').set('authorization', fresh).expect(200);
    if (status.body.data.available) return; // this server has a built-in model configured
    const res = await http()
      .post('/v1/learnings')
      .set('authorization', fresh)
      .send({ topic: 'Chess' })
      .expect(201);
    const l = await waitForReady(fresh, res.body.data.id);
    expect(l.options).toBeNull();
    expect(l.error).toMatch(/Settings → AI/);
  });

  it('exports without secrets and deletes everything', async () => {
    const exp = await http().get('/v1/me/export').set('authorization', auth).expect(200);
    const text = JSON.stringify(exp.body);
    expect(text).not.toContain(FAKE_KEY);
    expect(text).not.toContain('encryptedKey');
    expect(text).not.toContain('passwordHash');
    await http()
      .delete('/v1/me')
      .set('authorization', auth)
      .send({ password: 'wrong', confirmation: 'DELETE MY ACCOUNT' })
      .expect(400);
    await http()
      .delete('/v1/me')
      .set('authorization', auth)
      .send({ password: 'a-good-password-1', confirmation: 'DELETE MY ACCOUNT' })
      .expect(204);
    await http().get('/v1/learnings').set('authorization', auth).expect(401);
  });
});
