import { Buffer } from 'node:buffer';

import { revalidateTag } from 'next/cache';
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

interface DeleteBody {
  readonly slug?: string;
  readonly branch?: string;
  readonly message?: string;
}

interface GitHubContentResponse {
  readonly sha: string;
}

interface GitHubErrorBody {
  readonly message?: string;
  readonly documentation_url?: string;
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

function resolveTargetBranch(inputBranch: string | undefined): string {
  if (typeof inputBranch === 'string' && inputBranch.trim().length > 0) {
    return inputBranch.trim();
  }

  const envBranch = process.env.REPO_BRANCH;
  if (typeof envBranch === 'string' && envBranch.trim().length > 0) {
    return envBranch.trim();
  }

  return 'main';
}

function parseGitHubErrorMessage(status: number, rawText: string): string {
  try {
    const payload = JSON.parse(rawText) as GitHubErrorBody;
    const message = payload.message ?? rawText;
    const docs = payload.documentation_url ? `；文档：${payload.documentation_url}` : '';

    if (status === 403 && message.includes('Resource not accessible by personal access token')) {
      return 'GitHub Token 权限不足（403）。请使用可写入该仓库的 Token：fine-grained 需给 Contents: Read and write，或 classic 需 repo 权限。';
    }

    if (status === 401) {
      return `GitHub Token 无效或已过期（401）：${message}${docs}`;
    }

    if (status === 404) {
      return `目标仓库或分支不存在（404）：${message}${docs}`;
    }

    return `提交失败（${status}）：${message}${docs}`;
  } catch {
    return `提交失败（${status}）：${rawText}`;
  }
}

function getGitHubConfig(): { readonly token: string; readonly owner: string; readonly name: string } {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.REPO;
  if (!token || !repo) {
    throw new Error('缺少 GITHUB_TOKEN 或 REPO 环境变量');
  }
  const { owner, name } = parseRepo(repo);
  return { token, owner, name };
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

    const { token, owner, name } = getGitHubConfig();
    const branch = resolveTargetBranch(body.branch);
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
      const message = parseGitHubErrorMessage(response.status, text);
      return Response.json({ ok: false, message }, { status: response.status });
    }

    const result = await response.json();
    revalidateTag('posts');

    const deployHook = process.env.VERCEL_DEPLOY_HOOK_URL;
    let deployHint = `已提交到 ${branch} 分支；若 Vercel Production Branch 同为 ${branch}，将自动部署。`;
    if (deployHook) {
      const deployResponse = await fetch(deployHook, { method: 'POST' });
      deployHint = deployResponse.ok
        ? '已触发 Vercel Deploy Hook，部署已自动开始。'
        : `Deploy Hook 调用失败（${deployResponse.status}），但代码已提交成功。`;
    }

    return Response.json({
      ok: true,
      path: filePath,
      commit: result.commit?.sha ?? '',
      message: `保存成功。${deployHint}`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return Response.json({ ok: false, message }, { status: 400 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  if (!isAdminAuthenticated(cookies())) {
    return Response.json({ ok: false, message: '未登录或会话过期' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as DeleteBody;
    const slug = sanitizeSlug(requiredString(body.slug, 'slug'));
    if (!slug) {
      return Response.json({ ok: false, message: 'slug 不合法' }, { status: 400 });
    }

    const { token, owner, name } = getGitHubConfig();
    const branch = resolveTargetBranch(body.branch);

    const mdPath = `content/posts/${slug}.md`;
    const mdxPath = `content/posts/${slug}.mdx`;

    const mdSha = await fetchExistingSha({ owner, repo: name, path: mdPath, branch, token });
    const mdxSha = mdSha ? null : await fetchExistingSha({ owner, repo: name, path: mdxPath, branch, token });

    const targetPath = mdSha ? mdPath : mdxSha ? mdxPath : '';
    const targetSha = mdSha ?? mdxSha;

    if (!targetPath || !targetSha) {
      return Response.json({ ok: false, message: '目标文章不存在，无法删除' }, { status: 404 });
    }

    const commitMessage =
      typeof body.message === 'string' && body.message.trim().length > 0
        ? body.message.trim()
        : `delete post: ${slug}`;

    const response = await fetch(`https://api.github.com/repos/${owner}/${name}/contents/${targetPath}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        message: commitMessage,
        sha: targetSha,
        branch
      })
    });

    if (!response.ok) {
      const text = await response.text();
      const message = parseGitHubErrorMessage(response.status, text);
      return Response.json({ ok: false, message }, { status: response.status });
    }

    revalidateTag('posts');

    const deployHook = process.env.VERCEL_DEPLOY_HOOK_URL;
    let deployHint = `已删除并提交到 ${branch} 分支；若 Vercel Production Branch 同为 ${branch}，将自动部署。`;
    if (deployHook) {
      const deployResponse = await fetch(deployHook, { method: 'POST' });
      deployHint = deployResponse.ok
        ? '已触发 Vercel Deploy Hook，部署已自动开始。'
        : `Deploy Hook 调用失败（${deployResponse.status}），但删除提交已成功。`;
    }

    return Response.json({
      ok: true,
      path: targetPath,
      message: `删除成功。${deployHint}`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return Response.json({ ok: false, message }, { status: 400 });
  }
}
