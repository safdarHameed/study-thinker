import { Badge, type badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';
import { humanize } from '@/lib/format';

type Variant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

const STATUS_VARIANTS: Record<string, Variant> = {
  // Progress / topics
  LOCKED: 'muted',
  NOT_STARTED: 'outline',
  IN_PROGRESS: 'highlight',
  COMPLETED: 'success',
  SKIPPED: 'muted',
  // Journeys / goals / plans
  DRAFT: 'muted',
  ACTIVE: 'secondary',
  PAUSED: 'warning',
  ARCHIVED: 'muted',
  ACHIEVED: 'success',
  ABANDONED: 'muted',
  // Mastery
  LEARNING: 'info',
  PRACTICING: 'highlight',
  PROFICIENT: 'secondary',
  MASTERED: 'success',
  // Planner
  SCHEDULED: 'outline',
  MISSED: 'clay',
  RESCHEDULED: 'info',
  CANCELLED: 'muted',
  // Attempts
  SUBMITTED: 'info',
  EVALUATING: 'info',
  EVALUATED: 'success',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'outline'} className={className}>
      {humanize(status)}
    </Badge>
  );
}
