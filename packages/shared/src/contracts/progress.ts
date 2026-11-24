/** Motivation: XP, levels, streaks, a weekly goal and badges — all earned by real activity. */

export const ACTIVITY_XP = {
  learning_created: 5,
  journey_built: 10,
  lesson_opened: 5,
  step_done: 20,
  chat: 5,
  voice: 10,
  debate: 10,
  game: 10,
  assessment_done: 10,
  journey_finished: 100,
} as const;
export type ActivityKind = keyof typeof ACTIVITY_XP;

export interface BadgeDef {
  id: string;
  emoji: string;
  label: string;
  description: string;
}

export const BADGES: readonly BadgeDef[] = [
  { id: 'first-step', emoji: '👣', label: 'First step', description: 'Finish your first step.' },
  { id: 'on-a-roll', emoji: '🎯', label: 'On a roll', description: 'Finish 5 steps.' },
  { id: 'unstoppable', emoji: '🚀', label: 'Unstoppable', description: 'Finish 25 steps.' },
  { id: 'streak-3', emoji: '🔥', label: '3-day streak', description: 'Learn 3 days in a row.' },
  { id: 'streak-7', emoji: '⚡', label: 'Week warrior', description: 'Learn 7 days in a row.' },
  { id: 'streak-30', emoji: '🏆', label: 'Habit master', description: 'Learn 30 days in a row.' },
  {
    id: 'curious',
    emoji: '💬',
    label: 'Curious mind',
    description: 'Ask your teacher 10 questions.',
  },
  { id: 'voice', emoji: '🎙️', label: 'Found my voice', description: 'Take a voice lesson.' },
  { id: 'debater', emoji: '⚔️', label: 'Debater', description: 'Debate with the AI.' },
  { id: 'player', emoji: '🎮', label: 'Player', description: 'Finish a learning game.' },
  { id: 'tested', emoji: '📝', label: 'Tested', description: 'Complete an assessment.' },
  {
    id: 'perfect',
    emoji: '💯',
    label: 'Perfect score',
    description: 'Score 100 in an assessment.',
  },
  { id: 'finisher', emoji: '🎓', label: 'Finisher', description: 'Complete a whole journey.' },
  { id: 'explorer', emoji: '🧭', label: 'Explorer', description: 'Start 3 different learnings.' },
];

/** Total XP needed to reach `level` (level 1 needs 0). */
export function xpForLevel(level: number) {
  return 50 * (level - 1) * level;
}

export function levelFor(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  label: string;
  xp: number;
  learningId: string | null;
  createdAt: string;
}

export interface LearnerProgress {
  xp: number;
  level: number;
  /** XP at the start of the current level and at the next one. */
  levelFloor: number;
  levelCeil: number;
  streak: number;
  bestStreak: number;
  learnedToday: boolean;
  /** This week, Monday first: whether the learner learned that day. */
  week: boolean[];
  weekGoal: number;
  badges: { id: string; earnedAt: string | null }[];
  recent: ActivityEntry[];
}
