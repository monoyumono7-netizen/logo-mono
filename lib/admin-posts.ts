import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';

import { slugify } from '@/lib/utils';

const postsDirectory = path.join(process.cwd(), 'content', 'posts');

export interface AdminPostListItem {
  readonly slug: string;
  readonly fileName: string;
  readonly title: string;
  readonly date: string;
}

export interface AdminPostDetail {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly date: string;
  readonly updatedAt?: string;
  readonly tags: readonly string[];
  readonly cover?: string;
  readonly content: string;
}

function ensurePostsDirectory(): void {
  if (!fs.existsSync(postsDirectory)) {
    fs.mkdirSync(postsDirectory, { recursive: true });
  }
}

function getPostFiles(): readonly string[] {
  ensurePostsDirectory();
  return fs
    .readdirSync(postsDirectory)
    .filter((fileName) => fileName.endsWith('.md') || fileName.endsWith('.mdx'))
    .sort((a, b) => b.localeCompare(a));
}

function toStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeDate(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizeTitle(value: unknown, slug: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return slug;
}

function normalizeExcerpt(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

export function listAdminPosts(): readonly AdminPostListItem[] {
  return getPostFiles().map((fileName) => {
    const fullPath = path.join(postsDirectory, fileName);
    const source = fs.readFileSync(fullPath, 'utf8');
    const parsed = matter(source);
    const slug = fileName.replace(/\.mdx?$/, '');

    return {
      slug,
      fileName,
      title: normalizeTitle(parsed.data.title, slug),
      date: normalizeDate(parsed.data.date)
    };
  });
}

export function readAdminPostBySlug(slug: string): AdminPostDetail {
  const safeSlug = sanitizeSlug(slug);
  const filePathMd = path.join(postsDirectory, `${safeSlug}.md`);
  const filePathMdx = path.join(postsDirectory, `${safeSlug}.mdx`);
  const targetPath = fs.existsSync(filePathMd) ? filePathMd : filePathMdx;
  if (!fs.existsSync(targetPath)) {
    throw new Error(`文章不存在: ${safeSlug}`);
  }

  const source = fs.readFileSync(targetPath, 'utf8');
  const parsed = matter(source);

  return {
    slug: safeSlug,
    title: normalizeTitle(parsed.data.title, safeSlug),
    excerpt: normalizeExcerpt(parsed.data.excerpt),
    date: normalizeDate(parsed.data.date),
    updatedAt: typeof parsed.data.updatedAt === 'string' ? parsed.data.updatedAt : undefined,
    tags: toStringArray(parsed.data.tags),
    cover: typeof parsed.data.cover === 'string' ? parsed.data.cover : undefined,
    content: parsed.content.trimStart()
  };
}

export function sanitizeSlug(slug: string): string {
  return slugify(slug).replace(/\.mdx?$/, '').trim();
}

export function serializePostMarkdown(input: {
  readonly title: string;
  readonly excerpt: string;
  readonly date: string;
  readonly updatedAt?: string;
  readonly tags: readonly string[];
  readonly cover?: string;
  readonly content: string;
}): string {
  const lines = [
    '---',
    `title: ${JSON.stringify(input.title)}`,
    `excerpt: ${JSON.stringify(input.excerpt)}`,
    `date: ${JSON.stringify(input.date)}`
  ];

  if (input.updatedAt && input.updatedAt.trim().length > 0) {
    lines.push(`updatedAt: ${JSON.stringify(input.updatedAt)}`);
  }

  lines.push('tags:');
  const tags = input.tags.filter((tag) => tag.trim().length > 0);
  if (tags.length === 0) {
    lines.push('  - 未分类');
  } else {
    tags.forEach((tag) => {
      lines.push(`  - ${tag}`);
    });
  }

  if (input.cover && input.cover.trim().length > 0) {
    lines.push(`cover: ${JSON.stringify(input.cover)}`);
  }

  lines.push('---', '', input.content.trim(), '');
  return lines.join('\n');
}

export function isLikelyMarkdown(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length < 8) {
    return false;
  }

  const patterns = [/^#\s+/m, /^##\s+/m, /```[\s\S]*```/m, /\[[^\]]+\]\([^)]*\)/m, /^-\s+/m, /^\d+\.\s+/m];
  return patterns.some((pattern) => pattern.test(trimmed));
}
