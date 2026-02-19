import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AdminEditorForm } from '@/components/admin-editor-form';
import { isAdminAuthenticated } from '@/lib/admin-auth';

export default function AdminNewPostPage(): JSX.Element {
  if (!isAdminAuthenticated(cookies())) {
    redirect('/admin');
  }

  return (
    <section className="py-2 md:py-4">
      <AdminEditorForm
        mode="new"
        initialData={{
          slug: '',
          title: '',
          excerpt: '',
          date: new Date().toISOString().slice(0, 10),
          updatedAt: '',
          tags: [],
          cover: '',
          content: '# 新文章标题\n\n在这里开始写作...'
        }}
      />
    </section>
  );
}
