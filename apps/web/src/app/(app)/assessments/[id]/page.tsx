import { Suspense } from 'react';
import { AssessmentView } from '@/components/assessments/assessment-view';
import { LoadingState } from '@/components/common/loading-state';

async function Content({ params }: Pick<PageProps<'/assessments/[id]'>, 'params'>) {
  const { id } = await params;
  return <AssessmentView id={id} />;
}

export default function AssessmentPage({ params }: PageProps<'/assessments/[id]'>) {
  return (
    <Suspense fallback={<LoadingState label="Opening…" />}>
      <Content params={params} />
    </Suspense>
  );
}
