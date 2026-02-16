'use client';

import { useEffect, useMemo, useState } from 'react';

import type { TocItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PostEnhancementsProps {
  readonly toc: readonly TocItem[];
}

interface LightboxState {
  readonly open: boolean;
  readonly src: string;
  readonly alt: string;
}

function buildHeadingIds(toc: readonly TocItem[]): readonly string[] {
  return toc.map((item) => item.id);
}

export function PostEnhancements({ toc }: PostEnhancementsProps): JSX.Element {
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState>({ open: false, src: '', alt: '' });
  const headingIds = useMemo(() => buildHeadingIds(toc), [toc]);

  useEffect(() => {
    const onScroll = (): void => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = maxScroll <= 0 ? 0 : (window.scrollY / maxScroll) * 100;
      setProgress(Math.min(100, Math.max(0, ratio)));
      setShowTop(window.scrollY > 540);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    if (headingIds.length === 0) {
      return;
    }

    const elements = headingIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: '-25% 0px -60% 0px',
        threshold: [0.1, 0.4, 0.7]
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      elements.forEach((element) => observer.unobserve(element));
      observer.disconnect();
    };
  }, [headingIds]);

  useEffect(() => {
    const article = document.getElementById('post-content');
    if (!article) {
      return;
    }

    const codeBlocks = article.querySelectorAll<HTMLPreElement>('pre');
    codeBlocks.forEach((block) => {
      if (block.dataset.copyReady === 'yes') {
        return;
      }

      block.dataset.copyReady = 'yes';
      const button = document.createElement('button');
      button.className = 'copy-button';
      button.type = 'button';
      button.textContent = '复制';
      button.addEventListener('click', async () => {
        const code = block.querySelector('code')?.textContent ?? '';
        if (!code) {
          return;
        }
        await navigator.clipboard.writeText(code);
        button.textContent = '已复制';
        window.setTimeout(() => {
          button.textContent = '复制';
        }, 1400);
      });
      block.appendChild(button);
    });

    const onImageClick = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) {
        return;
      }

      setLightbox({
        open: true,
        src: target.currentSrc || target.src,
        alt: target.alt ?? '文章图片'
      });
    };

    article.addEventListener('click', onImageClick);
    return () => {
      article.removeEventListener('click', onImageClick);
    };
  }, []);

  return (
    <>
      <div className="fixed left-0 top-0 z-50 h-1 w-full bg-border">
        <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>

      {toc.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="fixed bottom-24 right-4 z-40 rounded-full border border-border bg-card px-4 py-2 text-sm text-text shadow-card md:hidden"
          >
            {mobileOpen ? '关闭目录' : '打开目录'}
          </button>

          <aside
            className={cn(
              'fixed right-4 top-24 z-30 w-64 rounded-xl border border-border bg-card p-4 shadow-card transition md:block',
              mobileOpen ? 'block' : 'hidden'
            )}
          >
            <p className="mb-3 text-sm font-semibold text-text">目录</p>
            <ul className="space-y-2 text-sm text-muted">
              {toc.map((item) => (
                <li key={item.id} className={item.level === 3 ? 'pl-3' : ''}>
                  <a
                    href={`#${item.id}`}
                    onClick={() => setMobileOpen(false)}
                    className={cn('transition hover:text-accent', activeId === item.id && 'toc-link-active')}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        </>
      ) : null}

      <button
        type="button"
        aria-label="返回顶部"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={cn(
          'fixed bottom-5 right-4 z-40 rounded-full border border-border bg-card px-4 py-2 text-sm text-text shadow-card transition',
          showTop ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        回到顶部
      </button>

      {lightbox.open ? (
        <button
          type="button"
          onClick={() => setLightbox({ open: false, src: '', alt: '' })}
          className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-black/85 p-4"
        >
          <img src={lightbox.src} alt={lightbox.alt} className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </button>
      ) : null}
    </>
  );
}
