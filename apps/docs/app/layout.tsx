import type { Metadata } from 'next';
import { IBM_Plex_Sans, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import { Provider } from '@/components/provider';
import './global.css';

const display = Space_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--gg-font-display', weight: ['500', '700'] });
const body = IBM_Plex_Sans({ subsets: ['latin', 'latin-ext'], variable: '--gg-font-body', weight: ['400', '500', '600'] });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], variable: '--gg-font-mono', weight: ['400', '600'] });

export const metadata: Metadata = {
  title: { default: 'Gamingalo', template: '%s · Gamingalo' },
  description: 'The SDK, CLI and platform for publishing web games.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
