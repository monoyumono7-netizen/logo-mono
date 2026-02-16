'use client';

import { useState } from 'react';

interface ShareButtonsProps {
  readonly title: string;
  readonly url: string;
}

export function ShareButtons({ title, url }: ShareButtonsProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const wechatQrcodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;

  const copyLink = async (): Promise<void> => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-semibold text-text">分享这篇文章</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <a
          href={twitterUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-border px-3 py-1.5 text-muted transition hover:text-text"
        >
          Twitter
        </a>
        <details className="group relative">
          <summary className="cursor-pointer list-none rounded-lg border border-border px-3 py-1.5 text-muted transition hover:text-text">
            微信
          </summary>
          <div className="absolute bottom-12 left-0 rounded-lg border border-border bg-card p-2 shadow-card">
            <img src={wechatQrcodeUrl} alt="微信分享二维码" width={180} height={180} className="h-[180px] w-[180px]" />
          </div>
        </details>
        <button
          type="button"
          onClick={() => {
            void copyLink();
          }}
          className="rounded-lg border border-border px-3 py-1.5 text-muted transition hover:text-text"
        >
          {copied ? '已复制' : '复制链接'}
        </button>
      </div>
    </div>
  );
}
