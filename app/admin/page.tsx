import { cookies } from 'next/headers';

import { AdminLoginForm } from '@/components/admin-login-form';
import { AdminPanel } from '@/components/admin-panel';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { listAdminPosts } from '@/lib/admin-posts';

export default async function AdminPage(): Promise<JSX.Element> {
  const authed = isAdminAuthenticated(cookies());
  if (!authed) {
    return (
      <section className="py-8 md:py-12">
        <AdminLoginForm />
      </section>
    );
  }

  const posts = await listAdminPosts();
  return (
    <section className="py-2 md:py-4">
      <AdminPanel initialPosts={posts} />
    </section>
  );
}
