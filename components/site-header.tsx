'use client';

import Link from 'next/link';

import { SITE_NAME } from '@/lib/constants';

function triggerSearch(): void {
  window.dispatchEvent(new Event('blog-search-open'));
}

export function SiteHeader(): JSX.Element {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/90 backdrop-blur-md">
      <div className="container-main flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-xl font-bold tracking-tight text-text">
          {SITE_NAME}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <Link href="/" className="rounded-md px-2 py-1 transition hover:bg-card hover:text-text">
            首页
          </Link>
          <a href="/feed.xml" className="rounded-md px-2 py-1 transition hover:bg-card hover:text-text">
            RSS
          </a>
          <button
            type="button"
            onClick={triggerSearch}
            aria-label="打开搜索"
            className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition hover:bg-card hover:text-text"
          >
            <span>搜索</span>
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px]">Ctrl K</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
