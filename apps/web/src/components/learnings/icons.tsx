import {
  BookOpenText,
  Brain,
  ClipboardCheck,
  Drama,
  Gamepad2,
  HandMetal,
  Image as ImageIcon,
  Layers,
  ListChecks,
  type LucideIcon,
  MessageCircle,
  MessagesSquare,
  Mic,
  PenLine,
  Phone,
  Presentation,
  Puzzle,
  ScrollText,
  Swords,
  UserRound,
  Video,
  Wrench,
} from 'lucide-react';

export const MODE_ICONS: Record<string, LucideIcon> = {
  reading: BookOpenText,
  chat: MessageCircle,
  voice: Phone,
  debate: Swords,
  practice: Wrench,
  stories: ScrollText,
  socratic: Brain,
  images: ImageIcon,
  video: Video,
  avatar: UserRound,
  games: Gamepad2,
  simulations: Puzzle,
};

export const ASSESSMENT_ICONS: Record<string, LucideIcon> = {
  quiz: ListChecks,
  written: PenLine,
  practical: HandMetal,
  scenario: Drama,
  oral: Mic,
  debate: MessagesSquare,
  flashcards: Layers,
  images: ImageIcon,
  interactive: Puzzle,
  presentation: Presentation,
};

export function ModeIcon({ id, className }: { id: string | null | undefined; className?: string }) {
  const Icon = (id && MODE_ICONS[id]) || BookOpenText;
  return <Icon className={className} aria-hidden />;
}

export function AssessmentIcon({
  id,
  className,
}: {
  id: string | null | undefined;
  className?: string;
}) {
  const Icon = (id && ASSESSMENT_ICONS[id]) || ClipboardCheck;
  return <Icon className={className} aria-hidden />;
}
