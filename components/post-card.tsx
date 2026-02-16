import Link from 'next/link';

import { formatDate } from '@/lib/date';
import type { PostSummary } from '@/lib/types';

interface PostCardProps {
  readonly post: PostSummary;
  readonly views?: number;
}

export function PostCard({ post, views = 0 }: PostCardProps): JSX.Element {
  return (
    <article className="group rounded-2xl border border-border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-accent/50">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        <span>·</span>
        <span>{post.readingTimeText}</span>
        <span>·</span>
        <span>{views} 阅读</span>
      </div>

      <h2 className="font-display text-2xl font-semibold tracking-tight text-text">
        <Link href={`/posts/${post.slug}`} className="transition group-hover:text-accent">
          {post.title}
        </Link>
      </h2>

      <p className="mt-3 text-sm leading-7 text-muted">{post.excerpt}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {post.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted">
            #{tag}
          </span>
        ))}
      </div>
    </article>
  );
}
