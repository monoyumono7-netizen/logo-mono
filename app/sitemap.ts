import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/constants';
import { getAllPostSummaries } from '@/lib/posts';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPostSummaries();

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1
    },
    ...posts.map((post) => ({
      url: `${SITE_URL}/posts/${post.slug}`,
      lastModified: new Date(post.updatedAt ?? post.date),
      changeFrequency: 'weekly' as const,
      priority: 0.8
    }))
  ];
}
