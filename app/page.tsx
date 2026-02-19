import { PostListPage } from '@/components/post-list-page';

export const revalidate = 15;

export default async function HomePage(): Promise<JSX.Element> {
  return <PostListPage currentPage={1} />;
}
