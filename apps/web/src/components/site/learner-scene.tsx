import {
  Briefcase,
  Code2,
  FlaskConical,
  Languages,
  type LucideIcon,
  Music,
  Palette,
  Sigma,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Hand-drawn flat illustration: a learner at their desk, with a ticking clock,
 * steaming mug, books and plant, the laptop lid glowing with the StudyThinker
 * mark, and subjects floating around them ("learn anything, any time").
 */
export function LearnerScene({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('relative', className)}>
      <svg
        viewBox="0 0 640 420"
        className="relative w-full"
        role="img"
        aria-label="A learner studying at their desk while subjects float around them"
      >
        <defs>
          <linearGradient id="ls-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#EEF2FF" />
            <stop offset="1" stopColor="#F5F3FF" />
          </linearGradient>
          <linearGradient id="ls-sweater" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366F1" />
            <stop offset="1" stopColor="#4338CA" />
          </linearGradient>
          <linearGradient id="ls-lid" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#27272A" />
            <stop offset="1" stopColor="#09090B" />
          </linearGradient>
          <radialGradient id="ls-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#A5B4FC" stopOpacity="0.9" />
            <stop offset="1" stopColor="#A5B4FC" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ls-l" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#22D3EE" />
            <stop offset="1" stopColor="#6366F1" />
          </linearGradient>
          <linearGradient id="ls-r" x1="1" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#A855F7" />
            <stop offset="1" stopColor="#6366F1" />
          </linearGradient>
        </defs>

        {/* Room */}
        <rect x="40" y="20" width="560" height="300" rx="36" fill="url(#ls-wall)" />
        <circle cx="520" cy="80" r="70" fill="#E0E7FF" opacity="0.6" />
        <circle cx="110" cy="260" r="60" fill="#CFFAFE" opacity="0.5" />

        {/* Window */}
        <g>
          <rect
            x="398"
            y="56"
            width="132"
            height="104"
            rx="12"
            fill="#fff"
            stroke="#E4E4E7"
            strokeWidth="3"
          />
          <rect x="406" y="64" width="116" height="88" rx="8" fill="#DBEAFE" />
          <circle cx="490" cy="92" r="12" fill="#FDE68A" />
          <path
            d="M406 140 C430 120 450 128 470 138 C490 128 506 130 522 140 V152 H406Z"
            fill="#BFDBFE"
          />
          <path d="M464 64 V152 M406 108 H522" stroke="#fff" strokeWidth="4" />
        </g>

        {/* Wall clock (always ticking: learn any time) */}
        <g>
          <circle cx="150" cy="96" r="40" fill="#fff" stroke="#E4E4E7" strokeWidth="4" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return (
              <line
                key={i}
                x1={150 + Math.sin(a) * 30}
                y1={96 - Math.cos(a) * 30}
                x2={150 + Math.sin(a) * (i % 3 === 0 ? 24 : 27)}
                y2={96 - Math.cos(a) * (i % 3 === 0 ? 24 : 27)}
                stroke={i % 3 === 0 ? '#3F3F46' : '#A1A1AA'}
                strokeWidth={i % 3 === 0 ? 3 : 2}
                strokeLinecap="round"
              />
            );
          })}
          <line
            x1="150"
            y1="96"
            x2="150"
            y2="78"
            stroke="#18181B"
            strokeWidth="4"
            strokeLinecap="round"
            className="animate-clock-hour"
            style={{ transformOrigin: '150px 96px', transformBox: 'view-box' }}
          />
          <line
            x1="150"
            y1="96"
            x2="150"
            y2="68"
            stroke="#6366F1"
            strokeWidth="3"
            strokeLinecap="round"
            className="animate-clock-min"
            style={{ transformOrigin: '150px 96px', transformBox: 'view-box' }}
          />
          <circle cx="150" cy="96" r="4" fill="#18181B" />
        </g>

        {/* Shelf with a trophy */}
        <rect x="206" y="150" width="96" height="6" rx="3" fill="#D4D4D8" />
        <path d="M232 128 h20 v6 a10 10 0 0 1 -20 0z" fill="#FBBF24" />
        <rect x="238" y="140" width="8" height="6" fill="#F59E0B" />
        <rect x="232" y="146" width="20" height="4" rx="2" fill="#D97706" />
        <rect x="266" y="126" width="10" height="24" rx="2" fill="#A78BFA" />
        <rect x="278" y="132" width="10" height="18" rx="2" fill="#22D3EE" />

        {/* Learner */}
        <g>
          {/* hair back */}
          <path
            d="M282 178 C276 132 302 116 324 116 C352 116 370 136 364 182 C352 170 300 172 282 178Z"
            fill="#1E1B2E"
          />
          <rect x="309" y="194" width="22" height="34" rx="8" fill="#D9A47E" />
          {/* torso */}
          <path
            d="M240 312 C240 252 268 224 320 224 C372 224 400 252 400 312 Z"
            fill="url(#ls-sweater)"
          />
          <path
            d="M300 226 Q320 246 340 226"
            fill="none"
            stroke="#C7D2FE"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* head */}
          <circle cx="320" cy="168" r="34" fill="#E8B48C" />
          <circle cx="286" cy="172" r="7" fill="#D9A47E" />
          <circle cx="354" cy="172" r="7" fill="#D9A47E" />
          {/* hair front */}
          <path
            d="M286 164 C288 136 306 128 324 128 C346 128 358 142 356 160 C344 148 326 146 312 150 C300 153 292 158 286 164Z"
            fill="#1E1B2E"
          />
          {/* face */}
          <circle cx="308" cy="174" r="3" fill="#18181B" />
          <circle cx="332" cy="174" r="3" fill="#18181B" />
          <path
            d="M310 188 Q320 196 330 188"
            fill="none"
            stroke="#9A3412"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="300" cy="184" r="5" fill="#FB7185" opacity="0.25" />
          <circle cx="340" cy="184" r="5" fill="#FB7185" opacity="0.25" />
          {/* headphones */}
          <path
            d="M284 168 C284 124 356 124 356 168"
            fill="none"
            stroke="#27272A"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <rect x="276" y="160" width="14" height="24" rx="6" fill="#6366F1" />
          <rect x="350" y="160" width="14" height="24" rx="6" fill="#6366F1" />
        </g>

        {/* Desk */}
        <rect x="90" y="300" width="460" height="18" rx="9" fill="#E4E4E7" />
        <rect x="128" y="316" width="12" height="84" rx="6" fill="#D4D4D8" />
        <rect x="500" y="316" width="12" height="84" rx="6" fill="#D4D4D8" />
        <rect x="120" y="396" width="400" height="6" rx="3" fill="#E4E4E7" opacity="0.6" />

        {/* Laptop (lid faces us, glowing StudyThinker mark) */}
        <ellipse cx="320" cy="262" rx="96" ry="50" fill="url(#ls-glow)" opacity="0.6" />
        <rect x="244" y="222" width="152" height="80" rx="10" fill="url(#ls-lid)" />
        <g transform="translate(302 238) scale(0.75)">
          <path d="M23 42C17 32 10 26 3 24c2-6 5-9 9-10 7 2 10 12 11 28Z" fill="url(#ls-l)" />
          <path d="M25 42c6-10 13-16 20-18-2-6-5-9-9-10-7 2-10 12-11 28Z" fill="url(#ls-r)" />
          <path
            d="M24 3.5c.9 5.2 3.8 8.1 9 9-5.2.9-8.1 3.8-9 9-.9-5.2-3.8-8.1-9-9 5.2-.9 8.1-3.8 9-9Z"
            fill="#A78BFA"
            className="animate-twinkle"
          />
        </g>
        <rect x="230" y="298" width="180" height="8" rx="4" fill="#3F3F46" />

        {/* Books */}
        <rect x="140" y="282" width="78" height="18" rx="3" fill="#22D3EE" />
        <rect x="146" y="264" width="70" height="18" rx="3" fill="#A78BFA" />
        <rect x="136" y="246" width="74" height="18" rx="3" fill="#FBBF24" />
        <path
          d="M146 290 h64 M152 272 h56 M142 254 h60"
          stroke="#fff"
          strokeOpacity="0.6"
          strokeWidth="2"
        />

        {/* Mug with steam */}
        <rect
          x="432"
          y="270"
          width="30"
          height="30"
          rx="6"
          fill="#fff"
          stroke="#E4E4E7"
          strokeWidth="3"
        />
        <path d="M462 278 a8 8 0 0 1 0 14" fill="none" stroke="#E4E4E7" strokeWidth="3" />
        <path
          d="M440 262 c-4 -6 4 -10 0 -16"
          fill="none"
          stroke="#A1A1AA"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="animate-steam [transform-box:fill-box] [transform-origin:50%_100%]"
        />
        <path
          d="M452 262 c-4 -6 4 -10 0 -16"
          fill="none"
          stroke="#A1A1AA"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="animate-steam [transform-box:fill-box] [transform-origin:50%_100%] [animation-delay:-1.5s]"
        />

        {/* Plant */}
        <path d="M498 300 h36 l-5 -30 h-26z" fill="#F97316" opacity="0.85" />
        <ellipse cx="506" cy="252" rx="10" ry="22" fill="#10B981" transform="rotate(-25 506 252)" />
        <ellipse cx="526" cy="248" rx="10" ry="24" fill="#34D399" transform="rotate(20 526 248)" />
        <ellipse cx="516" cy="242" rx="9" ry="26" fill="#059669" />
      </svg>

      {/* Floating subjects (learn anything) */}
      {!compact &&
        SUBJECTS.map((s, i) => (
          <span
            key={s.label}
            className="absolute grid size-11 animate-bob place-items-center rounded-2xl text-white shadow-lg ring-4 ring-white sm:size-14"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              background: s.bg,
              animationDelay: `${i * -0.7}s`,
            }}
            title={s.label}
          >
            <s.icon className="size-5 sm:size-6" aria-hidden />
          </span>
        ))}
    </div>
  );
}

const SUBJECTS: { icon: LucideIcon; label: string; x: number; y: number; bg: string }[] = [
  {
    icon: Languages,
    label: 'Languages',
    x: 31,
    y: 3,
    bg: 'linear-gradient(135deg,#22D3EE,#0EA5E9)',
  },
  { icon: Code2, label: 'Coding', x: 60, y: 1, bg: 'linear-gradient(135deg,#6366F1,#4F46E5)' },
  { icon: Sigma, label: 'Maths', x: 76, y: 42, bg: 'linear-gradient(135deg,#A855F7,#7C3AED)' },
  { icon: Music, label: 'Music', x: 5, y: 66, bg: 'linear-gradient(135deg,#EC4899,#DB2777)' },
  {
    icon: FlaskConical,
    label: 'Science',
    x: 44,
    y: -6,
    bg: 'linear-gradient(135deg,#10B981,#059669)',
  },
  { icon: Palette, label: 'Art', x: 90, y: 34, bg: 'linear-gradient(135deg,#F59E0B,#D97706)' },
  {
    icon: Briefcase,
    label: 'Business',
    x: 3,
    y: 16,
    bg: 'linear-gradient(135deg,#14B8A6,#0D9488)',
  },
];
