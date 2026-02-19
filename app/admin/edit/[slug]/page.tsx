import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { AdminEditorForm } from '@/components/admin-editor-form';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { readAdminPostBySlug } from '@/lib/admin-posts';

interface EditAdminPostPageProps {
  readonly params: {
    readonly slug: string;
  };
}

export default function EditAdminPostPage({ params }: EditAdminPostPageProps): JSX.Element {
  if (!isAdminAuthenticated(cookies())) {
    redirect('/admin');
  }

  try {
    const post = readAdminPostBySlug(params.slug);
    return (
      <section className="py-2 md:py-4">
        <AdminEditorForm
          mode="edit"
          initialData={{
            slug: post.slug,
            title: post.title,
            excerpt: post.excerpt,
            date: post.date,
            updatedAt: post.updatedAt,
            tags: post.tags,
            cover: post.cover,
            content: post.content
          }}
        />
      </section>
    );
  } catch {
    notFound();
  }
}
