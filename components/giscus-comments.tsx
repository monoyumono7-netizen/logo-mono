'use client';

import { useEffect, useMemo, useState } from 'react';

interface GiscusCommentsProps {
  readonly pathname: string;
}

function getPreferredTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function GiscusComments({ pathname }: GiscusCommentsProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const theme = useMemo(() => (typeof window === 'undefined' ? 'light' : getPreferredTheme()), []);

  useEffect(() => {
    const repo = process.env.NEXT_PUBLIC_GISCUS_REPO;
    const repoId = process.env.NEXT_PUBLIC_GISCUS_REPO_ID;
    const category = process.env.NEXT_PUBLIC_GISCUS_CATEGORY;
    const categoryId = process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID;

    if (!repo || !repoId || !category || !categoryId) {
      setLoading(false);
      setFailed(true);
      return;
    }

    const container = document.getElementById('giscus-container');
    if (!container) {
      return;
    }

    container.innerHTML = '';
    setLoading(true);
    setFailed(false);

    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-repo', repo);
    script.setAttribute('data-repo-id', repoId);
    script.setAttribute('data-category', category);
    script.setAttribute('data-category-id', categoryId);
    script.setAttribute('data-mapping', 'pathname');
    script.setAttribute('data-strict', '0');
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-input-position', 'top');
    script.setAttribute('data-theme', theme);
    script.setAttribute('data-lang', 'zh-CN');
    script.setAttribute('data-loading', 'lazy');
    script.setAttribute('data-term', pathname);

    const timeout = window.setTimeout(() => {
      setFailed(true);
      setLoading(false);
    }, 9000);

    script.addEventListener('load', () => {
      window.clearTimeout(timeout);
      setLoading(false);
    });

    script.addEventListener('error', () => {
      window.clearTimeout(timeout);
      setLoading(false);
      setFailed(true);
    });

    container.appendChild(script);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleTheme = (): void => {
      const iframe = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
      const currentTheme = media.matches ? 'dark' : 'light';
      iframe?.contentWindow?.postMessage(
        {
          giscus: {
            setConfig: {
              theme: currentTheme
            }
          }
        },
        'https://giscus.app'
      );
    };

    media.addEventListener('change', handleTheme);

    return () => {
      window.clearTimeout(timeout);
      media.removeEventListener('change', handleTheme);
    };
  }, [pathname, theme]);

  return (
    <section className="mt-12 rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 font-display text-2xl font-semibold text-text">评论</h2>
      {loading ? <p className="mb-3 text-sm text-muted">评论系统加载中...</p> : null}
      {failed ? (
        <p className="mb-3 rounded-lg border border-red-300/50 bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">
          评论加载失败，请检查 Giscus 配置或稍后重试。
        </p>
      ) : null}
      <div id="giscus-container" />
    </section>
  );
}
