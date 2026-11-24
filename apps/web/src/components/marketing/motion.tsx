'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from './use-reduced-motion';

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, inView]);
  return [ref, inView] as const;
}

/**
 * Fades and lifts its children into view. Exposes `data-shown` on a
 * `group/reveal` element, so descendants can animate with
 * `group-data-[shown=true]/reveal:` utilities.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  threshold,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
}) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(threshold);
  const shown = reduced || inView;
  return (
    <div
      ref={ref}
      data-shown={shown}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'group/reveal transition-[opacity,transform,filter] duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]',
        shown ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-8 opacity-0 blur-[3px]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Card with a soft indigo light that follows the pointer. */
export function SpotlightCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        ref.current!.style.setProperty('--x', `${e.clientX - r.left}px`);
        ref.current!.style.setProperty('--y', `${e.clientY - r.top}px`);
      }}
      className={cn(
        'group/spot relative overflow-hidden',
        'before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100',
        'before:bg-[radial-gradient(420px_circle_at_var(--x,50%)_var(--y,50%),rgba(99,102,241,0.11),transparent_45%)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Tilts its child back in 3D and straightens it as it scrolls into view. */
export function TiltOnScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(1);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      setP(Math.max(0, Math.min(1, (vh - top) / (vh * 0.75))));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  const progress = reduced ? 1 : p;
  return (
    <div ref={ref} className={cn('[perspective:1800px]', className)}>
      <div
        className="origin-top will-change-transform"
        style={{
          transform: `rotateX(${(1 - progress) * 22}deg) scale(${0.92 + progress * 0.08}) translateY(${(1 - progress) * 24}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Cycles through words with a soft blur-in, ending each loop on the last word. */
export function RotatingWord({ words, className }: { words: string[]; className?: string }) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(words.length - 1);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setI((n) => (n + 1) % words.length), 2200);
    return () => clearInterval(id);
  }, [reduced, words.length]);
  const word = reduced ? words[words.length - 1] : words[i];
  return (
    <span key={word} className={cn('inline-block animate-word-in', className)}>
      {word}
    </span>
  );
}

/** Thin gradient bar showing how far down the page the reader is. */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? window.scrollY / max : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div aria-hidden className="absolute inset-x-0 bottom-0 h-px">
      <div
        className="h-full origin-left bg-[linear-gradient(90deg,#22D3EE,#6366F1,#A855F7)]"
        style={{ transform: `scaleX(${p})` }}
      />
    </div>
  );
}
