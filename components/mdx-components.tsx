import Image from 'next/image';
import type { AnchorHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface ImageProps {
  readonly src?: string;
  readonly alt?: string;
}

function MdxImage({ src, alt }: ImageProps): JSX.Element | null {
  if (!src) {
    return null;
  }

  return (
    <Image
      src={src}
      alt={alt ?? '文章图片'}
      width={1600}
      height={900}
      sizes="(max-width: 768px) 100vw, 900px"
      className="h-auto w-full rounded-xl border border-border object-cover"
    />
  );
}

interface AnchorProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly href?: string;
}

function MdxLink({ href, className, ...props }: AnchorProps): JSX.Element {
  return (
    <a
      href={href}
      className={cn('text-accent underline-offset-4 hover:underline', className)}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  );
}

export const mdxComponents = {
  img: MdxImage,
  a: MdxLink
};
