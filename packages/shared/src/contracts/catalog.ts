/**
 * What StudyThinker can offer. The AI picks and recommends from these lists for
 * each topic; the app knows how to render every entry. Entries with
 * `available: false` are shown as "coming soon" and can't be selected yet.
 */

export interface CatalogEntry<Id extends string = string> {
  id: Id;
  label: string;
  description: string;
  available: boolean;
}

const entries = <const T extends readonly CatalogEntry[]>(list: T) => list;

// ───────────────────────── Journey shapes ─────────────────────────

export const JOURNEY_STRUCTURES = entries([
  {
    id: 'path',
    label: 'Step-by-step path',
    description: 'One clear step after another, from start to finish.',
    available: true,
  },
  {
    id: 'ladder',
    label: 'Ladder',
    description: 'Levels you climb. Each rung is a little harder than the last.',
    available: true,
  },
  {
    id: 'tree',
    label: 'Tree',
    description: 'A trunk of fundamentals that branches out into specialities.',
    available: true,
  },
  {
    id: 'clusters',
    label: 'Clusters',
    description: 'Groups of related ideas you can explore in any order.',
    available: true,
  },
  {
    id: 'mindmap',
    label: 'Mind map',
    description: 'One central idea with branches of connected topics.',
    available: true,
  },
  {
    id: 'timeline',
    label: 'Week by week',
    description: 'A calendar: what to learn in each week.',
    available: true,
  },
  {
    id: 'spiral',
    label: 'Spiral',
    description: 'Revisit the same themes in rounds, going deeper each time.',
    available: true,
  },
  {
    id: 'quest',
    label: 'Quest map',
    description: 'Worlds and levels with a boss challenge at the end of each.',
    available: true,
  },
  {
    id: 'project',
    label: 'Project-based',
    description: 'Learn by building something real, milestone by milestone.',
    available: true,
  },
  {
    id: 'chapters',
    label: 'Chapters',
    description: 'Like a book or course: chapters made of short sections.',
    available: true,
  },
  {
    id: 'board',
    label: 'Board',
    description: 'Cards in columns: to learn, learning, done.',
    available: true,
  },
  {
    id: 'web',
    label: 'Concept web',
    description: 'Ideas linked by what each one builds on.',
    available: true,
  },
]);
export type JourneyStructureId = (typeof JOURNEY_STRUCTURES)[number]['id'];
export const JOURNEY_STRUCTURE_IDS = JOURNEY_STRUCTURES.map((s) => s.id) as [
  JourneyStructureId,
  ...JourneyStructureId[],
];

// ───────────────────────── Ways of learning ─────────────────────────

export const LEARNING_MODES = entries([
  {
    id: 'reading',
    label: 'Reading lessons',
    description: 'Clear written lessons with examples.',
    available: true,
  },
  {
    id: 'chat',
    label: 'Interactive chat',
    description: 'Learn by talking it through with your teacher in chat.',
    available: true,
  },
  {
    id: 'voice',
    label: 'Voice lessons',
    description: 'Your teacher talks and you answer out loud, like a call.',
    available: true,
  },
  {
    id: 'debate',
    label: 'Debate',
    description: 'Argue a side and defend it against the AI.',
    available: true,
  },
  {
    id: 'practice',
    label: 'Hands-on practice',
    description: 'Exercises and small tasks to do yourself.',
    available: true,
  },
  {
    id: 'stories',
    label: 'Stories and examples',
    description: 'Ideas explained through stories, analogies and real cases.',
    available: true,
  },
  {
    id: 'socratic',
    label: 'Question-led',
    description: 'The teacher asks questions so you work things out yourself.',
    available: true,
  },
  {
    id: 'images',
    label: 'Pictures and diagrams',
    description: 'Diagrams drawn for each lesson, plus real photos from Wikimedia Commons.',
    available: true,
  },
  {
    id: 'video',
    label: 'Narrated slideshows',
    description: 'Watch each step as slides your teacher narrates out loud.',
    available: true,
  },
  {
    id: 'avatar',
    label: 'Face-to-face teacher',
    description: 'A teacher with a face you design, who talks with you.',
    available: true,
  },
  {
    id: 'games',
    label: 'Games',
    description:
      'Memory cards, word search, sorting and sequence puzzles, and a fact-or-fiction round.',
    available: true,
  },
  {
    id: 'simulations',
    label: 'Simulations',
    description: 'Step into a realistic situation and decide what to do — see what happens.',
    available: false,
  },
]);
export type LearningModeId = (typeof LEARNING_MODES)[number]['id'];
export const LEARNING_MODE_IDS = LEARNING_MODES.map((m) => m.id) as [
  LearningModeId,
  ...LearningModeId[],
];

// ───────────────────────── Ways of being assessed ─────────────────────────

export const ASSESSMENT_STYLES = entries([
  {
    id: 'quiz',
    label: 'Quiz',
    description: 'Multiple-choice questions, marked instantly.',
    available: true,
  },
  {
    id: 'written',
    label: 'Written answers',
    description: 'Explain in your own words; the AI gives feedback.',
    available: true,
  },
  {
    id: 'practical',
    label: 'Practical task',
    description: 'Do something real and describe or paste what you did.',
    available: true,
  },
  {
    id: 'scenario',
    label: 'Scenarios',
    description: 'Apply what you know to a realistic situation.',
    available: true,
  },
  {
    id: 'oral',
    label: 'Spoken answers',
    description: 'Answer questions out loud, like an oral exam.',
    available: true,
  },
  {
    id: 'debate',
    label: 'Debate with the AI',
    description: 'Defend a position; you are marked on your arguments.',
    available: true,
  },
  {
    id: 'flashcards',
    label: 'Flashcards',
    description: 'Quick recall: see a prompt, say the answer, check yourself.',
    available: true,
  },
  {
    id: 'images',
    label: 'Picture questions',
    description: 'Questions about diagrams and pictures.',
    available: true,
  },
  {
    id: 'interactive',
    label: 'Interactive challenges',
    description: 'Match pairs and put things in order — marked instantly.',
    available: true,
  },
  {
    id: 'presentation',
    label: 'Spoken presentation',
    description: 'Present what you learned out loud; the AI marks your talk.',
    available: true,
  },
]);
export type AssessmentStyleId = (typeof ASSESSMENT_STYLES)[number]['id'];
export const ASSESSMENT_STYLE_IDS = ASSESSMENT_STYLES.map((a) => a.id) as [
  AssessmentStyleId,
  ...AssessmentStyleId[],
];

// ───────────────────────── Who is learning ─────────────────────────

export const AUDIENCES = entries([
  { id: 'child', label: 'Child', description: 'Ages about 5–10.', available: true },
  { id: 'preteen', label: 'Pre-teen', description: 'Ages about 10–13.', available: true },
  { id: 'teen', label: 'Teenager', description: 'Ages about 13–18.', available: true },
  { id: 'adult', label: 'Adult', description: 'General adult learner.', available: true },
  {
    id: 'professional',
    label: 'Professional',
    description: 'Learning for work.',
    available: true,
  },
  {
    id: 'academic',
    label: 'Academic / researcher',
    description: 'University, postgraduate or PhD level.',
    available: true,
  },
  {
    id: 'senior',
    label: 'Older learner',
    description: 'Unhurried pace, plain language.',
    available: true,
  },
]);
export type AudienceId = (typeof AUDIENCES)[number]['id'];
export const AUDIENCE_IDS = AUDIENCES.map((a) => a.id) as [AudienceId, ...AudienceId[]];

export const STARTING_LEVELS = entries([
  { id: 'new', label: 'Completely new', description: 'Never studied this.', available: true },
  { id: 'basics', label: 'Know the basics', description: 'Some familiarity.', available: true },
  {
    id: 'intermediate',
    label: 'Intermediate',
    description: 'Comfortable, want to go further.',
    available: true,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Strong already, want depth or mastery.',
    available: true,
  },
]);
export type StartingLevelId = (typeof STARTING_LEVELS)[number]['id'];
export const STARTING_LEVEL_IDS = STARTING_LEVELS.map((a) => a.id) as [
  StartingLevelId,
  ...StartingLevelId[],
];

// ───────────────────────── Teacher ─────────────────────────

export const TEACHER_PERSONAS = entries([
  {
    id: 'friendly',
    label: 'Friendly coach',
    description: 'Warm, encouraging, celebrates progress.',
    available: true,
  },
  {
    id: 'professor',
    label: 'Professor',
    description: 'Precise, thorough and rigorous.',
    available: true,
  },
  {
    id: 'buddy',
    label: 'Playful buddy',
    description: 'Fun, light-hearted, lots of examples.',
    available: true,
  },
  {
    id: 'mentor',
    label: 'Calm mentor',
    description: 'Patient and unhurried, explains plainly.',
    available: true,
  },
  {
    id: 'socrates',
    label: 'Questioner',
    description: 'Answers questions with questions to make you think.',
    available: true,
  },
  {
    id: 'drill',
    label: 'Straight-talking trainer',
    description: 'Direct and challenging, pushes you hard.',
    available: true,
  },
]);
export type TeacherPersonaId = (typeof TEACHER_PERSONAS)[number]['id'];
export const TEACHER_PERSONA_IDS = TEACHER_PERSONAS.map((t) => t.id) as [
  TeacherPersonaId,
  ...TeacherPersonaId[],
];

export function catalogLabel(list: readonly CatalogEntry[], id: string | null | undefined) {
  return list.find((e) => e.id === id)?.label ?? id ?? '';
}
