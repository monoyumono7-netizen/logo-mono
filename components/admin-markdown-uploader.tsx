'use client';

import { useMemo, useRef, useState } from 'react';

import { waitForPostVisible } from '@/lib/client-post-visibility';
import { slugify } from '@/lib/utils';

interface ParsedUploadItem {
  readonly id: string;
  readonly originalFileName: string;
  readonly content: string;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string;
  readonly date: string;
  readonly tagsText: string;
}

interface AdminMarkdownUploaderProps {
  readonly onUploaded: (items: readonly { slug: string; title: string }[]) => void;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseFrontmatter(content: string): { readonly body: string; readonly title?: string; readonly date?: string; readonly tags?: string } {
  if (!content.startsWith('---\n')) {
    return { body: content };
  }
  const endIndex = content.indexOf('\n---\n', 4);
  if (endIndex < 0) {
    return { body: content };
  }

  const block = content.slice(4, endIndex);
  const body = content.slice(endIndex + 5);
  const titleMatch = /^title:\s*"?(.+)"?$/m.exec(block);
  const dateMatch = /^date:\s*"?(.+)"?$/m.exec(block);
  const tagsMatch = /^tags:\s*([\s\S]*?)(?:\n\w+:|$)/m.exec(block);
  const tagsRaw = tagsMatch?.[1]
    ?.split('\n')
    .map((line) => line.trim().replace(/^-\s*/, ''))
    .filter((line) => line.length > 0)
    .join(', ');

  return {
    body,
    title: titleMatch?.[1]?.trim(),
    date: dateMatch?.[1]?.trim(),
    tags: tagsRaw
  };
}

function isValidMarkdown(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length < 8) {
    return false;
  }
  return [/^#\s+/m, /^##\s+/m, /```[\s\S]*```/m, /\[[^\]]+\]\([^)]*\)/m, /^-\s+/m, /^\d+\.\s+/m].some((it) => it.test(trimmed));
}

export function AdminMarkdownUploader({ onUploaded }: AdminMarkdownUploaderProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<readonly ParsedUploadItem[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const canUpload = useMemo(
    () =>
      items.length > 0 &&
      items.every((item) => item.slug.trim().length > 0 && item.title.trim().length > 0 && item.content.trim().length > 0),
    [items]
  );

  const updateItem = (id: string, patch: Partial<ParsedUploadItem>): void => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const readFiles = async (files: readonly File[]): Promise<void> => {
    setMessage('');
    setError('');
    const parsed = await Promise.all(
      files.map(async (file) => {
        const content = await file.text();
        if (!isValidMarkdown(content)) {
          throw new Error(`文件 ${file.name} 不是有效 Markdown`);
        }
        const rawSlug = file.name.replace(/\.md$/i, '').replace(/\.mdx$/i, '');
        const frontmatter = parseFrontmatter(content);
        const firstHeading = /^#\s+(.+)$/m.exec(frontmatter.body)?.[1]?.trim();
        const title = frontmatter.title ?? firstHeading ?? rawSlug;

        return {
          id: `${file.name}-${file.size}-${file.lastModified}`,
          originalFileName: file.name,
          content: frontmatter.body.trim(),
          title,
          slug: slugify(rawSlug || title),
          excerpt: '',
          date: frontmatter.date ?? todayDate(),
          tagsText: frontmatter.tags ?? ''
        } satisfies ParsedUploadItem;
      })
    );

    setItems((prev) => [...prev, ...parsed]);
  };

  const onFileSelect = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }
    try {
      await readFiles(Array.from(fileList));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '读取文件失败');
    }
    event.target.value = '';
  };

  const onDrop = async (event: React.DragEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files).filter((file) => /\.mdx?$/i.test(file.name));
    if (files.length === 0) {
      setError('请拖入 .md 或 .mdx 文件');
      return;
    }
    try {
      await readFiles(files);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '读取文件失败');
    }
  };

  const onUpload = async (): Promise<void> => {
    if (!canUpload) {
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');

    const uploaded: { slug: string; title: string }[] = [];
    for (const item of items) {
      const response = await fetch('/api/github-commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slugify(item.slug),
          title: item.title,
          excerpt: item.excerpt,
          date: item.date,
          tags: item.tagsText,
          content: item.content,
          message: `upload post: ${slugify(item.slug)}`
        })
      });

      const data = (await response.json()) as { readonly ok?: boolean; readonly message?: string };
      if (!response.ok || !data.ok) {
        setError(data.message ?? `上传失败：${item.originalFileName}`);
        setSaving(false);
        return;
      }
      uploaded.push({ slug: slugify(item.slug), title: item.title });
    }

    setSaving(false);
    setItems([]);
    onUploaded(uploaded);

    const firstSlug = uploaded[0]?.slug;
    if (!firstSlug) {
      setMessage('保存成功');
      return;
    }

    const postPath = `/posts/${encodeURIComponent(firstSlug)}`;
    setMessage('上传成功，正在检测文章可见性并自动跳转...');
    const visible = await waitForPostVisible(postPath);
    if (visible) {
      window.location.href = postPath;
      return;
    }

    setMessage(`保存成功。文章还在发布中，请稍后访问 ${postPath}`);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold text-text">上传 Markdown 文件</h3>
          <p className="text-sm text-muted">支持拖拽或选择 .md/.mdx，多文件批量上传。</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition hover:border-accent/50"
        >
          选择文件
        </button>
        <input ref={inputRef} type="file" accept=".md,.mdx,text/markdown" multiple className="hidden" onChange={onFileSelect} />
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          void onDrop(event);
        }}
        className={`mt-3 rounded-xl border border-dashed p-4 text-sm ${
          dragging ? 'border-accent bg-accent/5 text-text' : 'border-border text-muted'
        }`}
      >
        把 Markdown 文件拖到这里，或点击“选择文件”。
      </div>

      {items.length > 0 ? (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border/70 bg-bg p-3">
              <p className="text-xs text-muted">{item.originalFileName}</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input
                  value={item.title}
                  onChange={(event) => updateItem(item.id, { title: event.target.value })}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none"
                  placeholder="标题"
                />
                <input
                  value={item.slug}
                  onChange={(event) => updateItem(item.id, { slug: slugify(event.target.value) })}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none"
                  placeholder="slug"
                />
                <input
                  value={item.date}
                  onChange={(event) => updateItem(item.id, { date: event.target.value })}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none"
                  placeholder="date: YYYY-MM-DD"
                />
                <input
                  value={item.tagsText}
                  onChange={(event) => updateItem(item.id, { tagsText: event.target.value })}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none"
                  placeholder="tags: 逗号分隔"
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            disabled={!canUpload || saving}
            onClick={() => {
              void onUpload();
            }}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? '上传中...' : '上传并提交'}
          </button>
        </div>
      ) : null}

      {message ? <p className="mt-3 rounded-lg border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 rounded-lg border border-red-300/50 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
