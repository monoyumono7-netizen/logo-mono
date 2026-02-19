# Next.js 14 个人博客（App Router）

一个可直接部署到 Vercel 的个人博客模板，支持：

- TypeScript + Tailwind CSS
- Markdown 文章源（`content/posts`）
- 首页分页、标签、阅读量
- 文章代码高亮、目录、阅读进度、回到顶部
- Fuse.js 本地全文搜索（Ctrl+K）
- Giscus 评论系统
- RSS / Sitemap / Robots / 404 / 社交分享
- Upstash Redis 阅读量统计与防刷

## 快速开始

```bash
npm install
npm run dev
```

## 环境变量

创建 `.env.local`：

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.com

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

NEXT_PUBLIC_GISCUS_REPO=owner/repo
NEXT_PUBLIC_GISCUS_REPO_ID=
NEXT_PUBLIC_GISCUS_CATEGORY=Announcements
NEXT_PUBLIC_GISCUS_CATEGORY_ID=

ADMIN_PASSWORD=
GITHUB_TOKEN=
REPO=owner/repo
VERCEL_DEPLOY_HOOK_URL=
```

## Giscus 配置步骤

1. 打开 `https://giscus.app/zh-CN`，按页面指引完成 GitHub Discussions 授权。
2. 复制仓库参数：`repo`、`repoId`、`category`、`categoryId`。
3. 写入 `.env.local` 对应环境变量。
4. 本项目已在 `components/giscus-comments.tsx` 使用 `pathname` 自动映射 discussion。

## 阅读量统计说明

1. 在 Upstash 创建 Redis 数据库。
2. 将 `REST URL` 和 `REST TOKEN` 填到 `.env.local`。
3. 文章页会调用 `POST /api/views/[slug]` 增加阅读量。
4. 同一 IP + UA 在 1 小时内只计一次，不记录原始 IP（哈希后存储）。

## Admin 管理后台

- 入口：`/admin`
- 登录：输入 `.env.local` 的 `ADMIN_PASSWORD`
- 功能：
  - 查看文章列表（读取本地 `content/posts`）
  - 新建文章（`/admin/new`）
  - 编辑文章（`/admin/edit/[slug]`）
  - 上传本地 Markdown（拖拽或多选）
- 保存机制：调用 `/api/github-commit`，使用 GitHub Contents API 提交到 `REPO` 对应仓库的 `content/posts/*.md`
- 可选：配置 `VERCEL_DEPLOY_HOOK_URL` 后，保存成功会自动触发一次部署 webhook

## 目录结构

```text
app/
  api/views/[slug]/route.ts
  feed.xml/route.ts
  posts/[slug]/page.tsx
  page.tsx
  page/[page]/page.tsx
  robots.ts
  search-index.json/route.ts
  sitemap.ts
  not-found.tsx
components/
  giscus-comments.tsx
  mdx-components.tsx
  pagination.tsx
  post-card.tsx
  post-enhancements.tsx
  post-list-page.tsx
  search-modal.tsx
  share-buttons.tsx
  site-footer.tsx
  site-header.tsx
  view-counter.tsx
content/posts/
  *.md
lib/
  constants.ts
  date.ts
  posts.ts
  types.ts
  utils.ts
  views.ts
```

## 部署到 Vercel

1. 推送项目到 GitHub。
2. 在 Vercel 导入仓库。
3. 配置上述环境变量。
4. 部署后验证以下地址：
   - `/sitemap.xml`
   - `/robots.txt`
   - `/feed.xml`
   - `/search-index.json`
