import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';

import matter from 'gray-matter';
import { compileMDX } from 'next-mdx-remote/rsc';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

import { mdxComponents } from '@/components/mdx-components';
import { POSTS_PER_PAGE } from '@/lib/constants';
import type { PostFrontmatter, PostSummary, SearchDocument, TocItem } from '@/lib/types';
import { estimateReadingTime, slugify, stripMarkdown } from '@/lib/utils';

const postsDirectory = path.join(process.cwd(), 'content', 'posts');

interface PostDetail extends PostSummary {
  readonly content: ReactNode;
  readonly toc: readonly TocItem[];
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
    .filter((fileName) => fileName.endsWith('.md') || fileName.endsWith('.mdx'));
}

function parseFrontmatter(content: string): PostFrontmatter {
  const data = matter(content).data;
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];

  return {
    title: typeof data.title === 'string' ? data.title : '未命名文章',
    excerpt: typeof data.excerpt === 'string' ? data.excerpt : '暂无摘要。',
    date: typeof data.date === 'string' ? data.date : new Date().toISOString(),
    tags,
    cover: typeof data.cover === 'string' ? data.cover : undefined,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined
  };
}

function extractToc(markdown: string): readonly TocItem[] {
  const headings: TocItem[] = [];

  const lines = markdown.split('\n');
  for (const line of lines) {
    const match = /^(##|###)\s+(.+)$/.exec(line.trim());
    if (!match) {
      continue;
    }
    const marks = match[1];
    const text = match[2]?.trim();
    if (!text) {
      continue;
    }
    headings.push({
      id: slugify(text),
      text,
      level: marks === '###' ? 3 : 2
    });
  }

  return headings;
}

function readPostSource(slug: string): { readonly markdown: string; readonly frontmatter: PostFrontmatter } {
  const filePathMd = path.join(postsDirectory, `${slug}.md`);
  const filePathMdx = path.join(postsDirectory, `${slug}.mdx`);
  const filePath = fs.existsSync(filePathMd) ? filePathMd : filePathMdx;

  if (!fs.existsSync(filePath)) {
    throw new Error(`文章不存在: ${slug}`);
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const { content } = matter(fileContent);

  return {
    markdown: content,
    frontmatter: parseFrontmatter(fileContent)
  };
}

function buildSummary(slug: string): PostSummary {
  const { markdown, frontmatter } = readPostSource(slug);

  return {
    slug,
    ...frontmatter,
    readingTimeText: estimateReadingTime(stripMarkdown(markdown))
  };
}

export function getAllPostSummaries(): readonly PostSummary[] {
  return getPostFiles()
    .map((fileName) => fileName.replace(/\.mdx?$/, ''))
    .map((slug) => buildSummary(slug))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export async function getPostBySlug(slug: string): Promise<PostDetail> {
  const { markdown, frontmatter } = readPostSource(slug);
  const toc = extractToc(markdown);

  const result = await compileMDX<PostFrontmatter>({
    source: markdown,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'append' }],
          [
            rehypePrettyCode,
            {
              keepBackground: false,
              theme: {
                light: 'github-light',
                dark: 'github-dark'
              }
            }
          ]
        ]
      }
    },
    components: mdxComponents
  });

  return {
    slug,
    ...frontmatter,
    readingTimeText: estimateReadingTime(stripMarkdown(markdown)),
    toc,
    content: result.content
  };
}

export function getPaginatedPosts(page: number): {
  readonly posts: readonly PostSummary[];
  readonly totalPages: number;
} {
  const allPosts = getAllPostSummaries();
  const totalPages = Math.max(1, Math.ceil(allPosts.length / POSTS_PER_PAGE));
  const validPage = Math.min(Math.max(page, 1), totalPages);
  const start = (validPage - 1) * POSTS_PER_PAGE;

  return {
    posts: allPosts.slice(start, start + POSTS_PER_PAGE),
    totalPages
  };
}

export function getAllSlugs(): readonly string[] {
  return getPostFiles().map((fileName) => fileName.replace(/\.mdx?$/, ''));
}

export function getSearchDocuments(): readonly SearchDocument[] {
  return getAllSlugs().map((slug) => {
    const { markdown, frontmatter } = readPostSource(slug);
    return {
      slug,
      title: frontmatter.title,
      excerpt: frontmatter.excerpt,
      tags: frontmatter.tags,
      date: frontmatter.date,
      content: stripMarkdown(markdown)
    };
  });
}
