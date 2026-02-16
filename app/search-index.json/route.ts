import { getSearchDocuments } from '@/lib/posts';

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const documents = getSearchDocuments();
  return Response.json(documents);
}
