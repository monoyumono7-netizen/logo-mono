import { createHash, timingSafeEqual } from 'node:crypto';

import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

const ADMIN_COOKIE_NAME = 'admin_session';
const ADMIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? '';
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

export function getAdminCookieName(): string {
  return ADMIN_COOKIE_NAME;
}

export function getAdminCookieMaxAgeSeconds(): number {
  return ADMIN_COOKIE_MAX_AGE_SECONDS;
}

export function isAdminPasswordReady(): boolean {
  return getAdminPassword().trim().length > 0;
}

export function verifyAdminPassword(input: string): boolean {
  const configured = getAdminPassword();
  if (!configured) {
    return false;
  }

  return isEqual(hashValue(input), hashValue(configured));
}

export function createAdminSessionToken(): string {
  const password = getAdminPassword();
  if (!password) {
    return '';
  }
  const secret = `${password}:admin:${process.env.REPO ?? 'local'}`;
  return hashValue(secret);
}

export function isAdminAuthenticated(cookieStore: ReadonlyRequestCookies): boolean {
  const expected = createAdminSessionToken();
  const fromCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? '';
  if (!expected || !fromCookie) {
    return false;
  }
  return isEqual(expected, fromCookie);
}
