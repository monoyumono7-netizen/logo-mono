import { PostListPage } from '@/components/post-list-page';

export default async function HomePage(): Promise<JSX.Element> {
  return <PostListPage currentPage={1} />;
}
