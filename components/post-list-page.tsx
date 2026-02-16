import { Pagination } from '@/components/pagination';
import { PostCard } from '@/components/post-card';
import { getPaginatedPosts } from '@/lib/posts';
import { getViewCountMap } from '@/lib/views';

interface PostListPageProps {
  readonly currentPage: number;
}

export async function PostListPage({ currentPage }: PostListPageProps): Promise<JSX.Element> {
  const { posts, totalPages } = getPaginatedPosts(currentPage);
  const viewsMap = await getViewCountMap(posts.map((post) => post.slug));

  return (
    <>
      <section>
        <h1 className="font-display text-4xl font-bold tracking-tight text-text md:text-5xl">文章</h1>
        <p className="mt-3 max-w-2xl text-base text-muted">记录工程实践、产品思考与开发笔记。</p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} views={viewsMap[post.slug] ?? 0} />
        ))}
      </section>

      <Pagination currentPage={currentPage} totalPages={totalPages} />
    </>
  );
}
