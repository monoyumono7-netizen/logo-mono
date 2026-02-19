'use client';

import { useMemo, useState } from 'react';

import { AdminMarkdownEditor } from '@/components/admin-markdown-editor';
import { slugify } from '@/lib/utils';

interface AdminEditorFormProps {
  readonly mode: 'new' | 'edit';
  readonly initialData: {
    readonly slug: string;
    readonly title: string;
    readonly excerpt: string;
    readonly date: string;
    readonly updatedAt?: string;
    readonly tags: readonly string[];
    readonly cover?: string;
    readonly content: string;
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdminEditorForm({ mode, initialData }: AdminEditorFormProps): JSX.Element {
  const [slug, setSlug] = useState(initialData.slug);
  const [title, setTitle] = useState(initialData.title);
  const [excerpt, setExcerpt] = useState(initialData.excerpt);
  const [date, setDate] = useState(initialData.date || today());
  const [updatedAt, setUpdatedAt] = useState(initialData.updatedAt ?? '');
  const [cover, setCover] = useState(initialData.cover ?? '');
  const [tagsText, setTagsText] = useState(initialData.tags.join(', '));
  const [content, setContent] = useState(initialData.content);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const normalizedSlug = useMemo(() => slugify(slug), [slug]);
  const missingFields = useMemo(() => {
    const fields: string[] = [];
    if (!title.trim()) {
      fields.push('标题');
    }
    if (!normalizedSlug) {
      fields.push('Slug');
    }
    if (!content.trim()) {
      fields.push('正文');
    }
    return fields;
  }, [content, normalizedSlug, title]);

  const onSave = async (): Promise<void> => {
    if (missingFields.length > 0) {
      setError(`请先完善以下字段：${missingFields.join('、')}`);
      setMessage('');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const response = await fetch('/api/github-commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: normalizedSlug,
        title,
        excerpt,
        date,
        updatedAt: updatedAt.trim() || undefined,
        cover: cover.trim() || undefined,
        tags: tagsText,
        content,
        message: `${mode === 'new' ? 'create' : 'update'} post: ${normalizedSlug}`
      })
    });

    const data = (await response.json()) as { readonly ok?: boolean; readonly message?: string };
    if (!response.ok || !data.ok) {
      setSaving(false);
      setError(data.message ?? '保存失败');
      return;
    }

    setSaving(false);
    setMessage(data.message ?? '保存成功，下次部署生效');
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text">{mode === 'new' ? '新建文章' : '编辑文章'}</h1>
        <p className="mt-1 text-sm text-muted">支持实时预览、快捷键和完整工具栏，保存后自动提交到 GitHub。</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-muted">
            标题
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (mode === 'new') {
                  setSlug(slugify(event.target.value));
                }
              }}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none"
            />
          </label>

          <label className="text-sm text-muted">
            Slug
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none"
            />
            <span className="mt-1 block text-xs">最终文件名：{normalizedSlug || '未设置'}.md</span>
          </label>

          <label className="text-sm text-muted">
            发布日期
            <input
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none"
              placeholder="YYYY-MM-DD"
            />
          </label>

          <label className="text-sm text-muted">
            更新日期（可选）
            <input
              value={updatedAt}
              onChange={(event) => setUpdatedAt(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none"
              placeholder="YYYY-MM-DD"
            />
          </label>

          <label className="text-sm text-muted md:col-span-2">
            摘要
            <input
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none"
            />
          </label>

          <label className="text-sm text-muted">
            标签（逗号分隔）
            <input
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none"
              placeholder="Next.js, TypeScript"
            />
          </label>

          <label className="text-sm text-muted">
            封面（可选）
            <input
              value={cover}
              onChange={(event) => setCover(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none"
              placeholder="/images/example.jpg"
            />
          </label>
        </div>
      </section>

      <AdminMarkdownEditor value={content} onChange={setContent} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            void onSave();
          }}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? '保存中...' : '保存并提交'}
        </button>
        <a href="/admin" className="rounded-lg border border-border bg-bg px-4 py-2 text-sm text-text transition hover:border-accent/50">
          返回列表
        </a>
      </div>

      {message ? <p className="rounded-lg border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-lg border border-red-300/50 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
