import {
  BookOpen,
  Boxes,
  CalendarDays,
  Columns3,
  GitFork,
  Hammer,
  Network,
  Orbit,
  Route,
  Share2,
  Swords,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

export const STRUCTURE_ICONS: Record<string, LucideIcon> = {
  path: Route,
  ladder: TrendingUp,
  tree: GitFork,
  clusters: Boxes,
  mindmap: Share2,
  timeline: CalendarDays,
  spiral: Orbit,
  quest: Swords,
  project: Hammer,
  chapters: BookOpen,
  board: Columns3,
  web: Network,
};

export function StructureIcon({
  structure,
  className,
}: {
  structure: string | null;
  className?: string;
}) {
  const Icon = (structure && STRUCTURE_ICONS[structure]) || Route;
  return <Icon className={className} aria-hidden />;
}
