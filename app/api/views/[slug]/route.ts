import { headers } from 'next/headers';

import { getViewCount, increaseViewCount } from '@/lib/views';

interface Params {
  readonly params: {
    readonly slug: string;
  };
}

function getClientIp(): string {
  const requestHeaders = headers();
  const forwarded = requestHeaders.get('x-forwarded-for');
  const realIp = requestHeaders.get('x-real-ip');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return realIp ?? 'unknown';
}

export async function GET(_: Request, { params }: Params): Promise<Response> {
  const views = await getViewCount(params.slug);
  return Response.json({ slug: params.slug, views });
}

export async function POST(_: Request, { params }: Params): Promise<Response> {
  try {
    const ip = getClientIp();
    const userAgent = headers().get('user-agent') ?? 'unknown';
    const result = await increaseViewCount({
      slug: params.slug,
      ip,
      userAgent
    });

    return Response.json({
      slug: params.slug,
      views: result.views,
      increased: result.increased
    });
  } catch {
    const views = await getViewCount(params.slug);
    return Response.json({ slug: params.slug, views, increased: false }, { status: 200 });
  }
}
