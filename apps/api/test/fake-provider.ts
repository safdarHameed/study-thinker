/**
 * A local OpenAI-compatible server with scripted answers, so the whole learning
 * flow can be tested without a paid model. It is a test double, never used by the app.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export const FAKE_KEY = 'fake-test-key';

function journey() {
  const groups = ['World 1: The Meadow', 'World 2: The Caves'];
  return {
    title: 'Guitar quest',
    overview: 'Two worlds to conquer.',
    steps: groups.flatMap((group, g) =>
      [0, 1, 2].map((i) => ({
        key: `w${g + 1}-${i + 1}`,
        title: i === 2 ? `Boss: ${group}` : `${group} part ${i + 1}`,
        summary: 'Something to learn.',
        kind: i === 2 ? 'assessment' : 'lesson',
        group,
        dependsOn: i ? [`w${g + 1}-${i}`] : [],
        minutes: 20,
        mode: i === 2 ? null : 'reading',
        assessmentStyle: i === 2 ? 'quiz' : null,
      })),
    ),
  };
}

function answer(system: string, user: string): string {
  if (system.includes('Propose the best options'))
    return `Sure! \`\`\`json\n${JSON.stringify({
      title: 'Guitar for beginners',
      summary: 'Play your first songs.',
      language: 'English',
      audience: { id: 'adult', reason: 'Adult learner.' },
      level: { id: 'new', reason: 'Beginner.' },
      duration: {
        amount: 6,
        unit: 'weeks',
        minutesPerSession: 20,
        sessionsPerWeek: 4,
        reason: 'Short daily practice.',
      },
      structures: [
        { id: 'quest', reason: 'Fun.' },
        { id: 'ladder', reason: 'Builds up.' },
      ],
      modes: [
        { id: 'practice', reason: '' },
        { id: 'telepathy', reason: '' },
        { id: 'reading', reason: '' },
      ],
      defaultModes: ['practice', 'telepathy', 'reading'],
      theoryPractice: 80,
      assessments: [
        { id: 'quiz', reason: '' },
        { id: 'written', reason: '' },
      ],
      defaultAssessments: ['quiz'],
      teacher: { id: 'friendly', reason: '' },
      extraQuestions: [
        {
          id: 'style',
          label: 'Which style?',
          multiple: false,
          options: ['Pop', 'Rock'],
          defaults: ['Pop'],
        },
      ],
    })}\n\`\`\``;
  if (system.includes('Design a complete learning journey')) return JSON.stringify(journey());
  if (system.includes('narrated slideshow'))
    return JSON.stringify({
      slides: [
        { title: 'Hello', bullets: ['One', 'Two'], narration: 'Welcome.', diagram: 'not mermaid' },
        {
          title: 'Posture',
          bullets: ['Sit up'],
          narration: 'Sit up.',
          diagram: 'flowchart TD\n A-->B',
        },
        { title: '', bullets: [], narration: '' },
      ],
    });
  if (system.includes('quick learning games'))
    return JSON.stringify({
      pairs: [
        { left: 'Fret', right: 'Strip' },
        { left: 'Capo', right: 'Clamp' },
        { left: 'Pick', right: 'Plectrum' },
      ],
      order: { prompt: 'Order it', items: ['a', 'b', 'c'] },
      truths: [{ statement: 'Six strings', answer: 'true', why: 'Standard.' }],
      groups: [
        { name: 'Parts', items: ['Neck', 'Body', 'neck'] },
        { name: 'Tools', items: ['Capo', 'Pick'] },
        { name: 'Empty', items: [] },
      ],
    });
  if (system.includes('This is a SIMULATION'))
    return 'You are a busker.\n\nA) Tune up\nB) Play now\nC) Ask for help';
  if (system.includes('Write the material for this step'))
    return '# Holding the guitar\n\nRest it on your leg.\n\n## Key points\n\n- Relax\n- Practise daily';
  if (system.includes('learning coach')) {
    if (user.includes('add'))
      return JSON.stringify({
        reply: 'Added it.',
        actions: [
          {
            type: 'add_steps',
            afterKey: 'w1-1',
            steps: [
              { key: 'strum', title: 'Strumming', kind: 'practice', group: 'World 1: The Meadow' },
            ],
          },
          { type: 'rename', title: 'My guitar quest' },
          { type: 'teleport', where: 'nowhere' },
        ],
      });
    if (user.includes('shorter'))
      return JSON.stringify({
        reply: 'Two weeks it is.',
        actions: [
          { type: 'update_preferences', changes: { duration: { amount: 2, unit: 'weeks' } } },
          { type: 'rebuild_journey', instructions: 'Fit 2 weeks' },
        ],
      });
    return JSON.stringify({ reply: 'Happy to help!', actions: [] });
  }
  if (system.includes('You write fair, accurate assessments')) {
    if (system.includes('Style: Interactive challenges'))
      return JSON.stringify({
        title: 'Challenge',
        instructions: 'Match and order.',
        questions: [
          {
            type: 'match',
            prompt: 'Match',
            options: ['A', 'B', 'C'],
            right: ['1', '2', '3'],
          },
          { type: 'order', prompt: 'Order', options: ['first', 'second', 'third'] },
          { type: 'match', prompt: 'Too few', options: ['A'], right: ['1'] },
        ],
      });
    if (system.includes('Style: Debate with the AI'))
      return JSON.stringify({
        title: 'Motion: teachers are essential',
        instructions: 'Argue a side.',
        questions: [],
      });
    return JSON.stringify({
      title: 'Quick quiz',
      instructions: 'Pick one.',
      questions: [
        {
          type: 'choice',
          prompt: 'How many strings?',
          options: ['4', '6'],
          answer: 1,
          explanation: 'Six.',
        },
        {
          type: 'choice',
          prompt: 'Fretting hand?',
          options: ['Left', 'Right'],
          answer: 'A',
          explanation: 'Left.',
        },
        { type: 'choice', prompt: 'Broken question', options: ['only one'], answer: 0 },
      ],
    });
  }
  if (system.includes('fair, encouraging examiner'))
    return JSON.stringify({
      items: [{ id: 'debate', score: 70, feedback: 'Good points.' }],
      summary: 'Nice.',
      strengths: ['Clear'],
      improvements: ['Evidence'],
    });
  if (system.includes('This is a SPOKEN lesson'))
    return 'Hello! Which leg does the guitar rest on?';
  return 'Great question — keep your shoulders relaxed.';
}

export async function startFakeProvider() {
  const calls: { system: string; user: string }[] = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c: Buffer) => (body += c.toString()));
    req.on('end', () => {
      const send = (status: number, data: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(data));
      };
      if (req.headers.authorization !== `Bearer ${FAKE_KEY}`)
        return send(401, { error: 'bad key' });
      if (req.url === '/v1/models')
        return send(200, {
          data: [{ id: 'fake-model' }, { id: 'broken-model' }, { id: 'text-embedding-x' }],
        });
      const parsed = JSON.parse(body) as {
        model?: string;
        messages: { role: string; content: string }[];
        stream?: boolean;
      };
      // A listed model the key can't actually use, like many real providers have.
      if (parsed.model === 'broken-model')
        return send(404, { error: { message: 'The model broken-model does not exist' } });
      const system = parsed.messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n');
      const user = parsed.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
      calls.push({ system, user });
      const content = answer(system, user);
      if (!parsed.stream)
        return send(200, { choices: [{ message: { role: 'assistant', content } }] });
      // Stream like OpenAI: small pieces, with a reasoning block to hide.
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const pieces = ['<thi', 'nk>planning…</th', 'ink>', ...(content.match(/[\s\S]{1,7}/g) ?? [])];
      for (const piece of pieces)
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
      res.end('data: [DONE]\n\n');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    calls,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
