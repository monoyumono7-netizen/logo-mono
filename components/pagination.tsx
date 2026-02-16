import { cn } from '@/lib/utils';

interface PaginationProps {
  readonly currentPage: number;
  readonly totalPages: number;
}

function getPageHref(page: number): string {
  return page === 1 ? '/' : `/page/${page}`;
}

export function Pagination({ currentPage, totalPages }: PaginationProps): JSX.Element {
  if (totalPages <= 1) {
    return <></>;
  }

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {pages.map((page) => (
        <a
          key={page}
          href={getPageHref(page)}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-sm transition',
            page === currentPage
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-card text-muted hover:text-text'
          )}
        >
          {page}
        </a>
      ))}
    </nav>
  );
}
