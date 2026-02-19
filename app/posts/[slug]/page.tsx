import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { GiscusComments } from '@/components/giscus-comments';
import { PostEnhancements } from '@/components/post-enhancements';
import { ShareButtons } from '@/components/share-buttons';
import { ViewCounter } from '@/components/view-counter';
import { formatDate } from '@/lib/date';
import { SITE_URL } from '@/lib/constants';
import { getPostBySlug } from '@/lib/posts';
import { getViewCount } from '@/lib/views';

export const revalidate = 15;

interface PostPageProps {
  readonly params: {
    readonly slug: string;
  };
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  try {
    const post = await getPostBySlug(params.slug);
    return {
      title: post.title,
      description: post.excerpt,
      openGraph: {
        title: post.title,
        description: post.excerpt,
        type: 'article',
        publishedTime: post.date,
        modifiedTime: post.updatedAt,
        tags: [...post.tags],
        url: `${SITE_URL}/posts/${post.slug}`
      },
      twitter: {
        card: 'summary_large_image',
        title: post.title,
        description: post.excerpt
      }
    };
  } catch {
    return {};
  }
}

export default async function PostPage({ params }: PostPageProps): Promise<JSX.Element> {
  try {
    const post = await getPostBySlug(params.slug);
    const initialViews = await getViewCount(post.slug);
    const postUrl = `${SITE_URL}/posts/${post.slug}`;

    return (
      <article className="relative mx-auto max-w-3xl">
        <PostEnhancements toc={post.toc} />

        <header className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted">
                #{tag}
              </span>
            ))}
          </div>

          <h1 className="font-display text-4xl font-bold tracking-tight text-text md:text-5xl">{post.title}</h1>
          <p className="mt-3 text-base text-muted">{post.excerpt}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>·</span>
            <span>{post.readingTimeText}</span>
            <span>·</span>
            <ViewCounter slug={post.slug} initialViews={initialViews} />
          </div>
        </header>

        <section id="post-content" className="prose-content">
          {post.content}
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-4 text-sm text-muted">
          <p>最后更新时间：{formatDate(post.updatedAt ?? post.date)}</p>
          <p className="mt-2">阅读时长：{post.readingTimeText}</p>
        </section>

        <ShareButtons title={post.title} url={postUrl} />
        <GiscusComments pathname={`/posts/${post.slug}`} />
      </article>
    );
  } catch {
    notFound();
  }
}
