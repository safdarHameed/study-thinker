import { Suspense } from 'react';
import { LoadingState } from '@/components/common/loading-state';
import { LearningView } from '@/components/learnings/learning-view';

async function Content({ params }: Pick<PageProps<'/learnings/[id]'>, 'params'>) {
  const { id } = await params;
  return <LearningView id={id} />;
}

export default function LearningPage({ params }: PageProps<'/learnings/[id]'>) {
  return (
    <Suspense fallback={<LoadingState label="Opening…" />}>
      <Content params={params} />
    </Suspense>
  );
}
