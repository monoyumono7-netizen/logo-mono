import { cookies } from 'next/headers';

import {
  createAdminSessionToken,
  getAdminCookieMaxAgeSeconds,
  getAdminCookieName,
  isAdminPasswordReady,
  verifyAdminPassword
} from '@/lib/admin-auth';

interface LoginBody {
  readonly password?: string;
}

export async function POST(request: Request): Promise<Response> {
  if (!isAdminPasswordReady()) {
    return Response.json({ ok: false, message: '未配置 ADMIN_PASSWORD' }, { status: 500 });
  }

  const body = (await request.json()) as LoginBody;
  const password = typeof body.password === 'string' ? body.password : '';
  if (!verifyAdminPassword(password)) {
    return Response.json({ ok: false, message: '密码错误' }, { status: 401 });
  }

  const cookieStore = cookies();
  cookieStore.set(getAdminCookieName(), createAdminSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: getAdminCookieMaxAgeSeconds()
  });

  return Response.json({ ok: true });
}
