import { createHash } from 'node:crypto';

import { Redis } from '@upstash/redis';

import { VIEW_THROTTLE_SECONDS } from '@/lib/constants';

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  return new Redis({ url, token });
}

function hashIdentifier(identifier: string): string {
  return createHash('sha256').update(identifier).digest('hex');
}

export async function getViewCount(slug: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) {
    return 0;
  }

  const value = await redis.get<number>(`views:${slug}`);
  return typeof value === 'number' ? value : 0;
}

export async function getViewCountMap(slugs: readonly string[]): Promise<Record<string, number>> {
  const redis = getRedisClient();
  if (!redis || slugs.length === 0) {
    return {};
  }

  const keys = slugs.map((slug) => `views:${slug}`);
  const values = await redis.mget<number[]>(...keys);
  return slugs.reduce<Record<string, number>>((accumulator, slug, index) => {
    const value = values[index];
    accumulator[slug] = typeof value === 'number' ? value : 0;
    return accumulator;
  }, {});
}

export async function increaseViewCount(options: {
  readonly slug: string;
  readonly ip: string;
  readonly userAgent: string;
}): Promise<{ readonly increased: boolean; readonly views: number }> {
  const redis = getRedisClient();
  if (!redis) {
    return { increased: false, views: 0 };
  }

  const keyInput = `${options.slug}:${options.ip}:${options.userAgent}`;
  const hash = hashIdentifier(keyInput);
  const throttleKey = `views:throttle:${options.slug}:${hash}`;
  const inserted = await redis.set(throttleKey, '1', {
    nx: true,
    ex: VIEW_THROTTLE_SECONDS
  });

  if (inserted !== 'OK') {
    const current = await getViewCount(options.slug);
    return { increased: false, views: current };
  }

  const views = await redis.incr(`views:${options.slug}`);
  return { increased: true, views };
}
