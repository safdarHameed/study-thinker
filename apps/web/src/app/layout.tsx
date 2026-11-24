import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible, JetBrains_Mono } from 'next/font/google';
import { geist } from '@/lib/site-font';
import { PREFERENCES_BOOT_SCRIPT } from '@/lib/preferences/theme';
import { Providers } from './providers';
import './globals.css';

const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-atkinson',
  display: 'swap',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'StudyThinker — the AI that teaches you anything',
    template: '%s · StudyThinker',
  },
  description:
    'Tell StudyThinker your goal. It plans, teaches, checks what you’ve mastered and adapts as you go.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${atkinson.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <InlineScript html={PREFERENCES_BOOT_SCRIPT} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-100 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
