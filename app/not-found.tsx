import Link from 'next/link';

export default function NotFoundPage(): JSX.Element {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center rounded-3xl border border-border bg-card px-6 py-16 text-center shadow-card">
      <p className="rounded-full border border-border px-3 py-1 text-xs text-muted">404 · 页面迷路了</p>
      <h1 className="mt-4 font-display text-5xl font-black tracking-tight text-text">你来到了无人区</h1>
      <p className="mt-4 max-w-md text-muted">这条链接可能过期了，或者文章已经搬家。先回首页，喝口水再继续探索。</p>
      <Link href="/" className="mt-8 rounded-xl border border-accent bg-accent px-5 py-2 text-sm font-semibold text-white">
        返回首页
      </Link>
    </section>
  );
}
