import { notFound } from 'next/navigation';

import { PostListPage } from '@/components/post-list-page';

export const revalidate = 15;

interface PageProps {
  readonly params: {
    readonly page: string;
  };
}

export default async function PaginationPage({ params }: PageProps): Promise<JSX.Element> {
  const page = Number(params.page);

  if (!Number.isInteger(page) || page < 1) {
    notFound();
  }

  return <PostListPage currentPage={page} />;
}
