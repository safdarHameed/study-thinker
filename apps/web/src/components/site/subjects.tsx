import {
  Briefcase,
  Code2,
  FlaskConical,
  GraduationCap,
  Languages,
  type LucideIcon,
  Music,
  Palette,
  Plus,
  Sigma,
} from 'lucide-react';
import { Reveal } from '@/components/marketing/motion';
import { cn } from '@/lib/utils';
import { SectionHeader } from './section-header';
import { aiText, container, headerGap, sectionY } from './tokens';

const SUBJECTS: {
  icon: LucideIcon;
  name: string;
  goal: string;
  glyph: string;
  from: string;
  to: string;
  tint: string;
}[] = [
  {
    icon: Languages,
    name: 'Languages',
    goal: '“Chat in Spanish by June”',
    glyph: 'Hola',
    from: '#22D3EE',
    to: '#0EA5E9',
    tint: 'from-cyan-50',
  },
  {
    icon: Code2,
    name: 'Coding',
    goal: '“Build my first web app”',
    glyph: '</>',
    from: '#6366F1',
    to: '#4F46E5',
    tint: 'from-indigo-50',
  },
  {
    icon: Sigma,
    name: 'Maths',
    goal: '“Finally get calculus”',
    glyph: '∑π',
    from: '#A855F7',
    to: '#7C3AED',
    tint: 'from-violet-50',
  },
  {
    icon: GraduationCap,
    name: 'Exam prep',
    goal: '“Pass my finals in 4 weeks”',
    glyph: 'A+',
    from: '#F43F5E',
    to: '#E11D48',
    tint: 'from-rose-50',
  },
  {
    icon: Music,
    name: 'Music',
    goal: '“Understand guitar theory”',
    glyph: '♪♫',
    from: '#EC4899',
    to: '#DB2777',
    tint: 'from-pink-50',
  },
  {
    icon: FlaskConical,
    name: 'Science',
    goal: '“Ace organic chemistry”',
    glyph: 'H₂O',
    from: '#10B981',
    to: '#059669',
    tint: 'from-emerald-50',
  },
  {
    icon: Briefcase,
    name: 'Career skills',
    goal: '“Get AWS certified”',
    glyph: '↗',
    from: '#14B8A6',
    to: '#0D9488',
    tint: 'from-teal-50',
  },
  {
    icon: Palette,
    name: 'Creative',
    goal: '“Learn UI design”',
    glyph: '✦',
    from: '#F59E0B',
    to: '#D97706',
    tint: 'from-amber-50',
  },
];

export function Subjects() {
  return (
    <section
      id="anything"
      className={`relative isolate scroll-mt-24 border-t border-zinc-100 ${sectionY}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(238,242,255,0.9),transparent)]"
      />
      <div className={container}>
        <SectionHeader
          index="01"
          name="Learn anything"
          title={
            <>
              Anything you want <span className={aiText}>to learn.</span>
            </>
          }
        >
          From a new language to a professional exam. If you can describe it, StudyThinker can teach
          it.
        </SectionHeader>

        <div className={`${headerGap} grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4`}>
          {SUBJECTS.map((s, i) => (
            <Reveal key={s.name} delay={i * 60}>
              <div
                className={cn(
                  'group relative h-full overflow-hidden rounded-3xl bg-gradient-to-br to-white p-5 ring-1 ring-zinc-200 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-30px_rgba(30,27,75,0.35)] sm:p-6',
                  s.tint,
                )}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-2 -bottom-4 animate-bob text-6xl font-bold tracking-tight opacity-[0.13] transition-opacity duration-500 select-none group-hover:opacity-25 sm:text-7xl"
                  style={{ color: s.to, animationDelay: `${i * -0.6}s` }}
                >
                  {s.glyph}
                </span>
                <span
                  className="relative grid size-12 place-items-center rounded-2xl text-white shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                  style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}
                >
                  <s.icon className="size-6" aria-hidden />
                </span>
                <p className="relative mt-8 font-semibold tracking-tight text-zinc-950 sm:text-lg">
                  {s.name}
                </p>
                <p className="relative mt-1 text-sm text-zinc-500">{s.goal}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200} className="mt-4">
          <div className="flex flex-col items-center justify-between gap-3 rounded-3xl border border-dashed border-zinc-300 bg-white px-6 py-5 text-center sm:flex-row sm:text-left">
            <p className="flex items-center gap-3 font-medium text-zinc-950">
              <span className="grid size-9 place-items-center rounded-xl bg-zinc-950 text-white">
                <Plus className="size-4" aria-hidden />
              </span>
              …and anything else you can put into words.
            </p>
            <a
              href="#"
              className="text-sm font-medium text-indigo-600 underline-offset-4 hover:underline"
            >
              Type your goal ↑
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
