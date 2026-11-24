import { useId } from 'react';
import { cn } from '@/lib/utils';

/** The assistant: a friendly robot head that blinks, looks around and talks. */
export function BotFace({ talking = false, className }: { talking?: boolean; className?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn(talking && 'bot-talking', className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="0.5" stopColor="#6366F1" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
      {/* antenna */}
      <line x1="32" y1="9" x2="32" y2="16" stroke="#6366F1" strokeWidth="3" strokeLinecap="round" />
      <circle className="bot-antenna" cx="32" cy="7.5" r="4" fill="#FACC15" />
      {/* ears */}
      <rect x="4" y="28" width="6" height="14" rx="3" fill="#6366F1" />
      <rect x="54" y="28" width="6" height="14" rx="3" fill="#A855F7" />
      {/* head */}
      <rect x="8" y="15" width="48" height="42" rx="15" fill={`url(#${id})`} />
      {/* visor */}
      <rect x="14" y="23" width="36" height="26" rx="11" fill="#0F172A" />
      {/* eyes */}
      <g className="bot-eyes" fill="#67E8F9">
        <ellipse cx="25" cy="34" rx="4" ry="4.6" />
        <ellipse cx="39" cy="34" rx="4" ry="4.6" />
      </g>
      <circle cx="26.4" cy="32.4" r="1.3" fill="#fff" />
      <circle cx="40.4" cy="32.4" r="1.3" fill="#fff" />
      {/* cheeks */}
      <circle cx="18.5" cy="41" r="2.2" fill="#F472B6" opacity="0.7" />
      <circle cx="45.5" cy="41" r="2.2" fill="#F472B6" opacity="0.7" />
      {/* mouth */}
      <path
        className="bot-mouth"
        d="M27 42.2 Q32 46.4 37 42.2"
        stroke="#67E8F9"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
