'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { AdminMarkdownUploader } from '@/components/admin-markdown-uploader';
import type { AdminPostSummary } from '@/lib/admin-types';

interface AdminPanelProps {
  readonly initialPosts: readonly AdminPostSummary[];
}

export function AdminPanel({ initialPosts }: AdminPanelProps): JSX.Element {
  const [posts, setPosts] = useState<readonly AdminPostSummary[]>(initialPosts);
  const [keyword, setKeyword] = useState('');
  const [message, setMessage] = useState('');

  const filteredPosts = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) {
      return posts;
    }
    return posts.filter(
      (post) =>
        post.slug.toLowerCase().includes(query) ||
        post.title.toLowerCase().includes(query) ||
        post.fileName.toLowerCase().includes(query)
    );
  }, [keyword, posts]);

  const onLogout = async (): Promise<void> => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin';
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-text">管理面板</h1>
            <p className="mt-1 text-sm text-muted">你可以创建、编辑、上传 Markdown 文章并提交到 GitHub。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/new" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:opacity-90">
              新建文章
            </Link>
            <button
              type="button"
              onClick={() => {
                void onLogout();
              }}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition hover:border-accent/50"
            >
              退出登录
            </button>
          </div>
        </div>
      </section>

      <AdminMarkdownUploader
        onUploaded={(uploaded) => {
          const nextPosts = [...posts];
          uploaded.forEach((item) => {
            const exists = nextPosts.some((post) => post.slug === item.slug);
            if (!exists) {
              nextPosts.unshift({
                slug: item.slug,
                fileName: `${item.slug}.md`,
                title: item.title,
                date: new Date().toISOString().slice(0, 10)
              });
            }
          });
          setPosts(nextPosts);
          setMessage('保存成功，正在检测是否已可访问。');
        }}
      />

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-text">文章列表</h2>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="按标题/slug 搜索"
            className="w-full max-w-xs rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none ring-accent transition focus:ring-2"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="px-2 py-2 font-medium">标题</th>
                <th className="px-2 py-2 font-medium">Slug</th>
                <th className="px-2 py-2 font-medium">日期</th>
                <th className="px-2 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.map((post) => (
                <tr key={post.slug} className="border-b border-border/50 text-text">
                  <td className="px-2 py-2">{post.title}</td>
                  <td className="px-2 py-2 text-muted">{post.slug}</td>
                  <td className="px-2 py-2 text-muted">{post.date}</td>
                  <td className="px-2 py-2">
                    <Link href={`/admin/edit/${post.slug}`} className="text-accent transition hover:opacity-75">
                      编辑
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {message ? <p className="rounded-lg border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
    </div>
  );
}
