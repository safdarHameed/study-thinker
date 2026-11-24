'use client';

import { BADGES, type LearnerProgress } from '@studythinker/shared';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useProgress } from '@/lib/queries';
import { fireConfetti } from './confetti';

/**
 * Watches the learner's progress and celebrates what changed: XP earned (with
 * the reason), new badges, and level-ups. Mounted once in the app shell.
 */
export function RewardWatcher() {
  const { data } = useProgress();
  const previous = useRef<LearnerProgress | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    const before = previous.current;
    previous.current = data;
    if (!before) return;

    const gained = data.xp - before.xp;
    if (gained > 0) {
      const seen = new Set(before.recent.map((r) => r.id));
      const fresh = data.recent.filter((r) => !seen.has(r.id));
      const reason = fresh.length === 1 ? fresh[0]!.label : `${fresh.length} things done`;
      toast(`+${gained} XP`, {
        description: reason,
        icon: <span className="text-base">✨</span>,
      });
    }
    const had = new Set(before.badges.filter((b) => b.earnedAt).map((b) => b.id));
    const newBadges = data.badges.filter((b) => b.earnedAt && !had.has(b.id));
    for (const b of newBadges) {
      const def = BADGES.find((d) => d.id === b.id);
      if (!def) continue;
      toast.success(`New badge: ${def.label}`, {
        description: def.description,
        icon: <span className="text-lg">{def.emoji}</span>,
        duration: 6000,
      });
    }
    if (data.level > before.level) {
      setLevelUp(data.level);
      fireConfetti({ count: 200 });
    } else if (newBadges.length) fireConfetti();
    if (data.streak > before.streak && data.streak > 1)
      toast(`${data.streak}-day streak!`, {
        icon: <span className="text-base">🔥</span>,
      });
  }, [data]);

  return (
    <Dialog open={levelUp !== null} onOpenChange={(o) => !o && setLevelUp(null)}>
      <DialogContent className="max-w-sm text-center">
        <div className="mx-auto grid size-24 animate-pop place-items-center rounded-full bg-[linear-gradient(135deg,#22D3EE,#6366F1,#A855F7)] text-4xl font-bold text-white shadow-lift">
          {levelUp}
        </div>
        <DialogTitle className="text-2xl">Level {levelUp}!</DialogTitle>
        <DialogDescription className="sr-only">You reached a new level.</DialogDescription>
        <Button onClick={() => setLevelUp(null)} className="mx-auto">
          Continue
        </Button>
      </DialogContent>
    </Dialog>
  );
}
