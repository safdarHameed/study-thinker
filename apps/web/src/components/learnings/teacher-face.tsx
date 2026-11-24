'use client';

import { DEFAULT_TEACHER_LOOK, type TeacherLook } from '@studythinker/shared';
import { cn } from '@/lib/utils';

export type FaceState = 'idle' | 'speaking' | 'listening' | 'thinking';

/**
 * The learner's teacher, drawn from their chosen look. It blinks, moves its
 * mouth while speaking, tilts its head while listening and looks up while thinking.
 */
export function TeacherFace({
  look = DEFAULT_TEACHER_LOOK,
  state = 'idle',
  size = 160,
  className,
}: {
  look?: TeacherLook;
  state?: FaceState;
  size?: number;
  className?: string;
}) {
  const { skin, hair, hairColor, glasses, outfit } = look;
  const hijab = hair === 'hijab';
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role="img"
      aria-label={
        state === 'speaking'
          ? 'Your teacher is speaking'
          : state === 'listening'
            ? 'Your teacher is listening'
            : state === 'thinking'
              ? 'Your teacher is thinking'
              : 'Your teacher'
      }
    >
      <defs>
        <clipPath id="face-clip">
          <circle cx="100" cy="100" r="100" />
        </clipPath>
      </defs>
      <g clipPath="url(#face-clip)">
        <rect width="200" height="200" fill={outfit} opacity="0.16" />
        <g
          className={cn(
            'origin-[100px_170px] transition-transform duration-500',
            state === 'listening' && 'rotate-[-5deg]',
            state === 'speaking' && 'animate-[face-nod_2.4s_ease-in-out_infinite]',
          )}
        >
          {/* long hair behind the head */}
          {hair === 'long' && (
            <path d="M48 92 Q46 160 62 182 L138 182 Q154 160 152 92 Z" fill={hairColor} />
          )}
          {/* shoulders */}
          <path d="M28 205 Q32 160 100 154 Q168 160 172 205 Z" fill={outfit} />
          {hijab ? (
            <path
              d="M46 100 Q46 40 100 38 Q154 40 154 100 L160 175 Q100 190 40 175 Z"
              fill={hairColor}
            />
          ) : (
            <rect x="88" y="128" width="24" height="32" rx="8" fill={skin} />
          )}
          {/* head */}
          <ellipse cx="100" cy="94" rx="44" ry="50" fill={skin} />
          {!hijab && (
            <>
              <ellipse cx="56" cy="98" rx="7" ry="10" fill={skin} />
              <ellipse cx="144" cy="98" rx="7" ry="10" fill={skin} />
            </>
          )}
          {/* hair */}
          {hair === 'short' && (
            <path
              d="M56 84 Q54 40 100 40 Q146 40 144 84 Q136 62 100 60 Q66 60 56 84 Z"
              fill={hairColor}
            />
          )}
          {hair === 'long' && (
            <path
              d="M54 96 Q50 38 100 38 Q150 38 146 96 Q140 64 112 58 Q90 70 60 74 Z"
              fill={hairColor}
            />
          )}
          {hair === 'bun' && (
            <>
              <circle cx="100" cy="34" r="16" fill={hairColor} />
              <path
                d="M56 84 Q56 42 100 42 Q144 42 144 84 Q132 60 100 58 Q68 60 56 84 Z"
                fill={hairColor}
              />
            </>
          )}
          {hair === 'curly' &&
            [
              [60, 70],
              [70, 52],
              [86, 44],
              [104, 42],
              [122, 46],
              [136, 58],
              [143, 74],
              [56, 86],
            ].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="14" fill={hairColor} />)}
          {hijab && (
            <path
              d="M58 92 Q58 52 100 50 Q142 52 142 92 Q130 66 100 64 Q70 66 58 92 Z"
              fill={hairColor}
              opacity="0.85"
            />
          )}
          {/* eyebrows */}
          <g
            className={cn(
              'transition-transform duration-300',
              state === 'thinking' && '-translate-y-1.5',
            )}
            stroke={hair === 'bald' || hijab ? '#3B2A20' : hairColor}
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M74 76 Q82 71 90 75" />
            <path d="M110 75 Q118 71 126 76" />
          </g>
          {/* eyes */}
          <g className="origin-[100px_90px] animate-[face-blink_5s_infinite]">
            <ellipse cx="82" cy="90" rx="5.5" ry="6.5" fill="#1F2937" />
            <ellipse cx="118" cy="90" rx="5.5" ry="6.5" fill="#1F2937" />
            <circle
              cx={state === 'thinking' ? 84 : 84}
              cy={state === 'thinking' ? 86 : 88}
              r="1.8"
              fill="#fff"
            />
            <circle cx="120" cy={state === 'thinking' ? 86 : 88} r="1.8" fill="#fff" />
          </g>
          {glasses && (
            <g stroke="#111827" strokeWidth="3" fill="none" opacity="0.85">
              <circle cx="82" cy="90" r="13" />
              <circle cx="118" cy="90" r="13" />
              <path d="M95 90 L105 90" />
            </g>
          )}
          {/* cheeks */}
          <circle cx="72" cy="108" r="7" fill="#F43F5E" opacity="0.12" />
          <circle cx="128" cy="108" r="7" fill="#F43F5E" opacity="0.12" />
          {/* mouth */}
          {state === 'speaking' ? (
            <ellipse
              cx="100"
              cy="118"
              rx="10"
              ry="6"
              fill="#7F1D1D"
              className="origin-[100px_118px] animate-[face-talk_0.32s_ease-in-out_infinite_alternate]"
            />
          ) : state === 'listening' ? (
            <ellipse cx="100" cy="118" rx="6" ry="4" fill="#7F1D1D" opacity="0.85" />
          ) : state === 'thinking' ? (
            <path
              d="M90 119 Q100 116 110 119"
              stroke="#7F1D1D"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <path
              d="M86 114 Q100 126 114 114"
              stroke="#7F1D1D"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </g>
      </g>
    </svg>
  );
}
