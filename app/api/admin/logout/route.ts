import { cookies } from 'next/headers';

import { getAdminCookieName } from '@/lib/admin-auth';

export async function POST(): Promise<Response> {
  const cookieStore = cookies();
  cookieStore.set(getAdminCookieName(), '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  });
  return Response.json({ ok: true });
}
