import type { Metadata } from 'next';
import { Sora, IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import { SearchModal } from '@/components/search-modal';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/constants';

import './globals.css';

const sora = Sora({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display' });
const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });
const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
    types: {
      'application/rss+xml': `${SITE_URL}/feed.xml`
    }
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION
  }
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${sora.variable} ${plex.variable} ${jetBrainsMono.variable}`}>
        <SiteHeader />
        <main className="container-main py-8 md:py-10">{children}</main>
        <SiteFooter />
        <SearchModal />
      </body>
    </html>
  );
}
