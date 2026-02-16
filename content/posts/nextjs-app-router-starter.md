---
title: "Next.js 14 博客从零搭建实战"
excerpt: "从 App Router、Markdown 管线到 SEO，一次性搭出可上线的个人博客。"
date: "2026-02-10"
updatedAt: "2026-02-14"
tags:
  - Next.js
  - TypeScript
  - Tailwind
cover: "/images/blog-cover-1.jpg"
---

## 为什么选择 App Router

App Router 能把布局、数据获取和路由组织在同一层结构中，工程可维护性更高。

## Markdown 内容管线

文章内容放在 `content/posts`，通过 `gray-matter` 解析 frontmatter，再用 `next-mdx-remote` 渲染。

```ts
export function parsePost(raw: string): { title: string; content: string } {
  const parsed = matter(raw);
  return {
    title: String(parsed.data.title ?? '未命名'),
    content: parsed.content
  };
}
```

## SEO 与内容分发

利用 `app/sitemap.ts` 和 `app/robots.ts` 自动生成站点索引，再通过 `feed.xml` 生成 RSS。

![工作流图](/images/blog-cover-1.jpg)

## 小结

这套方案兼顾了写作体验、部署效率和长期维护成本。
