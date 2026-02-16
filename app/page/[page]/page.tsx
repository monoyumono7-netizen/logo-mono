import { notFound } from 'next/navigation';

import { PostListPage } from '@/components/post-list-page';
import { getPaginatedPosts } from '@/lib/posts';

interface PageProps {
  readonly params: {
    readonly page: string;
  };
}

export function generateStaticParams(): { page: string }[] {
  const { totalPages } = getPaginatedPosts(1);
  return Array.from({ length: totalPages }, (_, index) => ({
    page: String(index + 1)
  }));
}

export default async function PaginationPage({ params }: PageProps): Promise<JSX.Element> {
  const page = Number(params.page);

  if (!Number.isInteger(page) || page < 1) {
    notFound();
  }

  return <PostListPage currentPage={page} />;
}
