import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { geist } from '@/lib/site-font';

/** The public site uses a crisp, light-only canvas regardless of the app theme. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${geist.variable} lw-site flex min-h-dvh w-full flex-col overflow-x-clip antialiased`}
    >
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
