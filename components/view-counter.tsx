'use client';

import { useEffect, useState } from 'react';

interface ViewCounterProps {
  readonly slug: string;
  readonly initialViews: number;
}

export function ViewCounter({ slug, initialViews }: ViewCounterProps): JSX.Element {
  const [views, setViews] = useState(initialViews);

  useEffect(() => {
    let cancelled = false;

    const updateViews = async (): Promise<void> => {
      const response = await fetch(`/api/views/${slug}`, { method: 'POST' });
      if (!response.ok || cancelled) {
        return;
      }
      const data = (await response.json()) as { readonly views?: number };
      if (typeof data.views === 'number') {
        setViews(data.views);
      }
    };

    void updateViews();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return <span>{views} 阅读</span>;
}
