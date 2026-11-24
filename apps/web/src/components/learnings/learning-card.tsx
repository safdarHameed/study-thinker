'use client';

import {
  catalogLabel,
  JOURNEY_STRUCTURES,
  shortTitle,
  type LearningSummary,
} from '@studythinker/shared';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { describeError } from '@/lib/api';
import { useDeleteLearning } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { StructureIcon } from './structure-icon';

const STATUS: Record<LearningSummary['status'], { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-info-soft text-info' },
  BUILDING: { label: 'Building…', className: 'bg-highlight-soft text-highlight' },
  READY: { label: 'Active', className: 'bg-success-soft text-success' },
  FAILED: { label: 'Failed', className: 'bg-warning-soft text-warning' },
};

export function LearningCard({ learning }: { learning: LearningSummary }) {
  const remove = useDeleteLearning();
  const pct = learning.progress.total
    ? Math.round((learning.progress.done / learning.progress.total) * 100)
    : 0;
  const status =
    learning.status === 'READY' &&
    learning.progress.total &&
    learning.progress.done === learning.progress.total
      ? { label: 'Done', className: 'bg-success-soft text-success' }
      : STATUS[learning.status];

  return (
    <article className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-lift">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <StructureIcon structure={learning.structure} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">
            <Link
              href={`/learnings/${learning.id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:underline"
            >
              {shortTitle(learning.title)}
            </Link>
          </h3>
          {learning.structure && (
            <p className="truncate text-sm text-muted-foreground">
              {catalogLabel(JOURNEY_STRUCTURES, learning.structure)}
            </p>
          )}
        </div>
        <AlertDialog>
          <AlertDialogTrigger
            className="relative z-10 grid size-8 place-items-center rounded-md text-muted-foreground opacity-70 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={`Delete ${shortTitle(learning.title)}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Delete “{shortTitle(learning.title)}”?</AlertDialogTitle>
            <AlertDialogDescription>This can’t be undone.</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() =>
                  remove.mutate(learning.id, {
                    onError: (e) => toast.error(describeError(e).description),
                  })
                }
              >
                <Trash2 aria-hidden /> Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {status.label !== 'Active' && (
        <span
          className={cn(
            'mt-4 self-start rounded-full px-2.5 py-1 text-xs font-medium',
            status.className,
          )}
        >
          {status.label}
        </span>
      )}
      {learning.progress.total > 0 && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </article>
  );
}
