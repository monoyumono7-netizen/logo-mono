'use client';

import { useEffect, useMemo, useState } from 'react';
import type FuseType from 'fuse.js';

import { formatDate } from '@/lib/date';
import type { SearchDocument } from '@/lib/types';
import { cn } from '@/lib/utils';

type FuseInstance = FuseType<SearchDocument>;

interface SearchResultItem {
  readonly item: SearchDocument;
  readonly matches: readonly string[];
}

function buildPreview(item: SearchResultItem): string {
  const matched = item.matches.find((value) => value.trim().length > 0);
  if (matched) {
    return matched.length > 120 ? `${matched.slice(0, 120)}...` : matched;
  }
  return item.item.excerpt;
}

function highlightText(text: string, keyword: string): JSX.Element {
  if (!keyword.trim()) {
    return <>{text}</>;
  }
  const lowerKeyword = keyword.toLowerCase();
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);
  if (index < 0) {
    return <>{text}</>;
  }
  const before = text.slice(0, index);
  const middle = text.slice(index, index + keyword.length);
  const after = text.slice(index + keyword.length);
  return (
    <>
      {before}
      <mark className="rounded bg-accent/20 px-1 text-text">{middle}</mark>
      {after}
    </>
  );
}

export function SearchModal(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState<readonly SearchDocument[]>([]);
  const [fuse, setFuse] = useState<FuseInstance | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const openModal = (): void => {
      setOpen(true);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('blog-search-open', openModal);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('blog-search-open', openModal);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open || fuse) {
      return;
    }

    let cancelled = false;

    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const [dataResponse, fuseModule] = await Promise.all([
          fetch('/search-index.json'),
          import('fuse.js')
        ]);

        if (!dataResponse.ok) {
          return;
        }

        const data = (await dataResponse.json()) as SearchDocument[];
        if (cancelled) {
          return;
        }

        const Fuse = fuseModule.default;
        const fuseInstance = new Fuse(data, {
          keys: ['title', 'content', 'tags'],
          threshold: 0.32,
          includeMatches: true,
          minMatchCharLength: 1
        });
        setDocuments(data);
        setFuse(fuseInstance);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, fuse]);

  const results = useMemo<readonly SearchResultItem[]>(() => {
    if (!query.trim()) {
      return documents.slice(0, 8).map((item) => ({ item, matches: [] }));
    }
    if (!fuse) {
      return [];
    }

    return fuse.search(query, { limit: 12 }).map((result) => ({
      item: result.item,
      matches: (result.matches ?? []).map((match) => String(match.value ?? ''))
    }));
  }, [documents, fuse, query]);

  if (!open) {
    return <></>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/55 p-4 md:p-10">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border p-4">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、正文、标签..."
            className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm outline-none ring-accent transition focus:ring-2"
          />
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-3">
          {loading ? <p className="p-3 text-sm text-muted">搜索索引加载中...</p> : null}

          {!loading && results.length === 0 ? <p className="p-3 text-sm text-muted">没有匹配结果</p> : null}

          <ul className="space-y-2">
            {results.map((result) => (
              <li key={result.item.slug}>
                <a
                  href={`/posts/${result.item.slug}`}
                  className={cn(
                    'block rounded-xl border border-border/70 bg-bg px-4 py-3 transition hover:border-accent/50 hover:bg-card'
                  )}
                >
                  <p className="font-display text-base font-semibold text-text">{highlightText(result.item.title, query)}</p>
                  <p className="mt-1 overflow-hidden text-ellipsis text-sm text-muted">
                    {highlightText(buildPreview(result), query)}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span>{formatDate(result.item.date)}</span>
                    <span>{result.item.tags.join(' / ')}</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end border-t border-border p-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-1.5 text-xs text-muted transition hover:bg-bg hover:text-text"
          >
            关闭 Esc
          </button>
        </div>
      </div>
    </div>
  );
}
