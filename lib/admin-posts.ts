import fs from 'node:fs';
import path from 'node:path';

import { unstable_cache } from 'next/cache';
import matter from 'gray-matter';

import { slugify } from '@/lib/utils';

const postsDirectory = path.join(process.cwd(), 'content', 'posts');
const ADMIN_POSTS_REVALIDATE_SECONDS = 15;

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

interface PostSource {
  readonly slug: string;
  readonly fileName: string;
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

function getLocalPostSources(): readonly PostSource[] {
  ensurePostsDirectory();
  const files = fs
    .readdirSync(postsDirectory)
    .filter((fileName) => fileName.endsWith('.md') || fileName.endsWith('.mdx'))
    .sort((a, b) => b.localeCompare(a));

  return files.map((fileName) => {
    const fullPath = path.join(postsDirectory, fileName);
    return {
      slug: fileName.replace(/\.mdx?$/, ''),
      fileName,
      source: fs.readFileSync(fullPath, 'utf8')
    } satisfies PostSource;
  });
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
    next: { revalidate: ADMIN_POSTS_REVALIDATE_SECONDS, tags: ['posts'] }
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
        return {
          slug: fileName.replace(/\.mdx?$/, ''),
          fileName,
          source
        } satisfies PostSource;
      })
    );

    return sources.sort((a, b) => b.fileName.localeCompare(a.fileName));
  } catch (error) {
    console.error('[admin-posts] 远程读取失败，回退本地文件：', error);
    return null;
  }
}

const getRemotePostSources = unstable_cache(loadRemotePostSources, ['admin-remote-post-sources'], {
  revalidate: ADMIN_POSTS_REVALIDATE_SECONDS,
  tags: ['posts']
});

async function listPostSources(): Promise<readonly PostSource[]> {
  const remote = await getRemotePostSources();
  if (remote) {
    return remote;
  }
  return getLocalPostSources();
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

export async function listAdminPosts(): Promise<readonly AdminPostListItem[]> {
  const sources = await listPostSources();
  const posts = sources.map((item) => {
    const parsed = matter(item.source);
    return {
      slug: item.slug,
      fileName: item.fileName,
      title: normalizeTitle(parsed.data.title, item.slug),
      date: normalizeDate(parsed.data.date)
    } satisfies AdminPostListItem;
  });

  return posts.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export async function readAdminPostBySlug(slug: string): Promise<AdminPostDetail> {
  const safeSlug = sanitizeSlug(slug);
  const sources = await listPostSources();
  const matched = sources.find((item) => item.slug === safeSlug);
  if (!matched) {
    throw new Error(`文章不存在: ${safeSlug}`);
  }

  const parsed = matter(matched.source);

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
