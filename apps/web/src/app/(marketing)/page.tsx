import { Suspense } from 'react';
import { AccountDeletedNotice } from '@/components/site/account-deleted-notice';
import { AdaptiveAssess } from '@/components/site/adaptive-assess';
import { DeadlinePlanner } from '@/components/site/deadline-planner';
import { FinalCta } from '@/components/site/final-cta';
import { Hero } from '@/components/site/hero';
import { Subjects } from '@/components/site/subjects';
import { TestPrep } from '@/components/site/test-prep';

export default function LandingPage() {
  return (
    <>
      <Suspense>
        <AccountDeletedNotice />
      </Suspense>
      <Hero />
      <Subjects />
      <DeadlinePlanner />
      <AdaptiveAssess />
      <TestPrep />
      <FinalCta />
    </>
  );
}
