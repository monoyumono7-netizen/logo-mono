import { Buffer } from 'node:buffer';

import { cookies } from 'next/headers';

import { isAdminAuthenticated } from '@/lib/admin-auth';
import { sanitizeSlug, serializePostMarkdown } from '@/lib/admin-posts';

interface CommitBody {
  readonly slug?: string;
  readonly title?: string;
  readonly excerpt?: string;
  readonly date?: string;
  readonly updatedAt?: string;
  readonly tags?: readonly string[] | string;
  readonly cover?: string;
  readonly content?: string;
  readonly message?: string;
  readonly branch?: string;
}

interface GitHubContentResponse {
  readonly sha: string;
}

function parseRepo(repo: string): { readonly owner: string; readonly name: string } {
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error('REPO 必须是 owner/repo 格式');
  }
  return { owner, name };
}

function normalizeTags(tags: CommitBody['tags']): readonly string[] {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag).trim())
      .filter((tag) => tag.length > 0);
  }
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }
  return [];
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} 不能为空`);
  }
  return value.trim();
}

async function fetchExistingSha(options: {
  readonly owner: string;
  readonly repo: string;
  readonly path: string;
  readonly branch: string;
  readonly token: string;
}): Promise<string | null> {
  const url = `https://api.github.com/repos/${options.owner}/${options.repo}/contents/${options.path}?ref=${options.branch}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${options.token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    },
    cache: 'no-store'
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`读取 GitHub 文件失败: ${response.status} ${text}`);
  }

  const data = (await response.json()) as GitHubContentResponse;
  return typeof data.sha === 'string' ? data.sha : null;
}

export async function POST(request: Request): Promise<Response> {
  if (!isAdminAuthenticated(cookies())) {
    return Response.json({ ok: false, message: '未登录或会话过期' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CommitBody;
    const slug = sanitizeSlug(requiredString(body.slug, 'slug'));
    const title = requiredString(body.title, 'title');
    const excerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() : '';
    const date = requiredString(body.date, 'date');
    const content = requiredString(body.content, 'content');
    const tags = normalizeTags(body.tags);

    if (!slug) {
      return Response.json({ ok: false, message: 'slug 不合法' }, { status: 400 });
    }

    const markdown = serializePostMarkdown({
      title,
      excerpt,
      date,
      updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt.trim() : undefined,
      tags,
      cover: typeof body.cover === 'string' ? body.cover.trim() : undefined,
      content
    });

    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.REPO;
    if (!token || !repo) {
      return Response.json({ ok: false, message: '缺少 GITHUB_TOKEN 或 REPO 环境变量' }, { status: 500 });
    }

    const { owner, name } = parseRepo(repo);
    const branch = typeof body.branch === 'string' && body.branch.trim().length > 0 ? body.branch.trim() : 'main';
    const filePath = `content/posts/${slug}.md`;
    const sha = await fetchExistingSha({ owner, repo: name, path: filePath, branch, token });

    const commitMessage =
      typeof body.message === 'string' && body.message.trim().length > 0
        ? body.message.trim()
        : `${sha ? 'update' : 'create'} post: ${slug}`;

    const response = await fetch(`https://api.github.com/repos/${owner}/${name}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        message: commitMessage,
        content: Buffer.from(markdown, 'utf8').toString('base64'),
        branch,
        sha: sha ?? undefined
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return Response.json({ ok: false, message: `提交失败: ${response.status} ${text}` }, { status: 500 });
    }

    const result = await response.json();

    const deployHook = process.env.VERCEL_DEPLOY_HOOK_URL;
    if (deployHook) {
      void fetch(deployHook, { method: 'POST' });
    }

    return Response.json({
      ok: true,
      path: filePath,
      commit: result.commit?.sha ?? '',
      message: '保存成功，下次部署生效'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return Response.json({ ok: false, message }, { status: 400 });
  }
}
