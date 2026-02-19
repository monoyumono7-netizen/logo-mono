import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/constants';
import { getAllPostSummaries } from '@/lib/posts';

export const revalidate = 3600;

function escapeXml(content: string): string {
  return content
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET(): Promise<Response> {
  const posts = await getAllPostSummaries();

  const items = posts
    .map((post) => {
      const link = `${SITE_URL}/posts/${post.slug}`;
      return `
        <item>
          <title>${escapeXml(post.title)}</title>
          <description>${escapeXml(post.excerpt)}</description>
          <link>${link}</link>
          <guid>${link}</guid>
          <pubDate>${new Date(post.date).toUTCString()}</pubDate>
        </item>
      `;
    })
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>${escapeXml(SITE_NAME)}</title>
      <link>${SITE_URL}</link>
      <description>${escapeXml(SITE_DESCRIPTION)}</description>
      ${items}
    </channel>
  </rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
}
