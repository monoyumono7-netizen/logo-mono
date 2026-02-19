import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';

import { unstable_cache } from 'next/cache';

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
const POSTS_REVALIDATE_SECONDS = 15;

interface PostDetail extends PostSummary {
  readonly content: ReactNode;
  readonly toc: readonly TocItem[];
}

interface PostSource {
  readonly slug: string;
  readonly source: string;
}

interface GitTreeEntry {
  readonly path: string;
  readonly type: string;
  readonly sha?: string;
}

interface GitTreeResponse {
  readonly tree?: readonly GitTreeEntry[];
}

interface GitBlobResponse {
  readonly content?: string;
  readonly encoding?: string;
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

function getGitHubRepoConfig(): { readonly owner: string; readonly repo: string; readonly branch: string } | null {
  const repoValue = process.env.REPO;
  if (!repoValue) {
    return null;
  }

  const [owner, repo] = repoValue.split('/');
  if (!owner || !repo) {
    return null;
  }

  const branch = process.env.REPO_BRANCH?.trim() || 'main';
  return { owner, repo, branch };
}

function getGitHubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  if (token && token.trim().length > 0) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  return headers;
}

async function fetchGitHubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: getGitHubHeaders(),
    next: { revalidate: POSTS_REVALIDATE_SECONDS, tags: ['posts'] }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub 请求失败 ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

async function loadRemotePostSources(): Promise<readonly PostSource[] | null> {
  const config = getGitHubRepoConfig();
  if (!config) {
    return null;
  }

  try {
    const treeUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/git/trees/${config.branch}?recursive=1`;
    const tree = await fetchGitHubJson<GitTreeResponse>(treeUrl);
    const entries = tree.tree ?? [];

    const postEntries = entries.filter(
      (entry) =>
        entry.type === 'blob' &&
        entry.path.startsWith('content/posts/') &&
        /\.mdx?$/.test(entry.path) &&
        typeof entry.sha === 'string' &&
        entry.sha.length > 0
    );

    const sources = await Promise.all(
      postEntries.map(async (entry) => {
        const blobUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/git/blobs/${entry.sha}`;
        const blob = await fetchGitHubJson<GitBlobResponse>(blobUrl);
        if (!blob.content || blob.encoding !== 'base64') {
          throw new Error(`读取 blob 失败: ${entry.path}`);
        }

        const source = Buffer.from(blob.content.replace(/\n/g, ''), 'base64').toString('utf8');
        const fileName = entry.path.split('/').pop() ?? '';
        const slug = fileName.replace(/\.mdx?$/, '');
        return { slug, source } satisfies PostSource;
      })
    );

    return sources;
  } catch (error) {
    console.error('[posts] 远程读取失败，回退本地文件：', error);
    return null;
  }
}

const getRemotePostSources = unstable_cache(loadRemotePostSources, ['remote-post-sources'], {
  revalidate: POSTS_REVALIDATE_SECONDS,
  tags: ['posts']
});

function getLocalPostSources(): readonly PostSource[] {
  return getPostFiles().map((fileName) => {
    const filePath = path.join(postsDirectory, fileName);
    return {
      slug: fileName.replace(/\.mdx?$/, ''),
      source: fs.readFileSync(filePath, 'utf8')
    } satisfies PostSource;
  });
}

async function listPostSources(): Promise<readonly PostSource[]> {
  const remote = await getRemotePostSources();
  if (remote) {
    return remote;
  }
  return getLocalPostSources();
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

async function readPostSource(slug: string): Promise<{ readonly markdown: string; readonly frontmatter: PostFrontmatter }> {
  const sources = await listPostSources();
  const matched = sources.find((item) => item.slug === slug);
  if (!matched) {
    throw new Error(`文章不存在: ${slug}`);
  }

  const fileContent = matched.source;
  const { content } = matter(fileContent);

  return {
    markdown: content,
    frontmatter: parseFrontmatter(fileContent)
  };
}

async function buildSummary(slug: string): Promise<PostSummary> {
  const { markdown, frontmatter } = await readPostSource(slug);

  return {
    slug,
    ...frontmatter,
    readingTimeText: estimateReadingTime(stripMarkdown(markdown))
  };
}

export async function getAllPostSummaries(): Promise<readonly PostSummary[]> {
  const sources = await listPostSources();
  const summaries = await Promise.all(sources.map((item) => buildSummary(item.slug)));
  return summaries.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export async function getPostBySlug(slug: string): Promise<PostDetail> {
  const { markdown, frontmatter } = await readPostSource(slug);
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

export async function getPaginatedPosts(page: number): Promise<{
  readonly posts: readonly PostSummary[];
  readonly totalPages: number;
}> {
  const allPosts = await getAllPostSummaries();
  const totalPages = Math.max(1, Math.ceil(allPosts.length / POSTS_PER_PAGE));
  const validPage = Math.min(Math.max(page, 1), totalPages);
  const start = (validPage - 1) * POSTS_PER_PAGE;

  return {
    posts: allPosts.slice(start, start + POSTS_PER_PAGE),
    totalPages
  };
}

export async function getAllSlugs(): Promise<readonly string[]> {
  const sources = await listPostSources();
  return sources.map((item) => item.slug);
}

export async function getSearchDocuments(): Promise<readonly SearchDocument[]> {
  const slugs = await getAllSlugs();
  const docs = await Promise.all(
    slugs.map(async (slug) => {
      const { markdown, frontmatter } = await readPostSource(slug);
      return {
        slug,
        title: frontmatter.title,
        excerpt: frontmatter.excerpt,
        tags: frontmatter.tags,
        date: frontmatter.date,
        content: stripMarkdown(markdown)
      } satisfies SearchDocument;
    })
  );

  return docs;
}
