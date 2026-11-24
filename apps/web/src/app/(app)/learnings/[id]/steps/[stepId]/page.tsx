import { Suspense } from 'react';
import { LoadingState } from '@/components/common/loading-state';
import { StepView } from '@/components/learnings/step-view';

async function Content({ params }: Pick<PageProps<'/learnings/[id]/steps/[stepId]'>, 'params'>) {
  const { id, stepId } = await params;
  return <StepView learningId={id} stepId={stepId} />;
}

export default function StepPage({ params }: PageProps<'/learnings/[id]/steps/[stepId]'>) {
  return (
    <Suspense fallback={<LoadingState label="Opening…" />}>
      <Content params={params} />
    </Suspense>
  );
}
