import type { Metadata } from 'next';
import { LearningsView } from '@/components/learnings/learnings-view';

export const metadata: Metadata = { title: 'My learnings' };

export default function LearningsPage() {
  return <LearningsView />;
}
