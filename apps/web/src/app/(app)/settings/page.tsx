import type { Metadata } from 'next';
import { ChangePasswordForm } from '@/components/auth/password-forms';
import { SectionCard } from '@/components/common/section-card';
import { AccountData, ProfileForm } from '@/components/settings/account-section';
import { AiSettingsSection } from '@/components/settings/ai-settings';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Settings</h1>
      <SectionCard title="Profile">
        <ProfileForm />
      </SectionCard>
      <div id="ai" className="scroll-mt-24">
        <SectionCard title="AI models">
          <AiSettingsSection />
        </SectionCard>
      </div>
      <SectionCard title="Password">
        <ChangePasswordForm />
      </SectionCard>
      <SectionCard title="Data">
        <AccountData />
      </SectionCard>
    </div>
  );
}
