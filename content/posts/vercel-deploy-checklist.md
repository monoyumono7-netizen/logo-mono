---
title: "Vercel 部署前检查清单"
excerpt: "环境变量、SEO 文件、缓存策略，一次部署就稳定可用。"
date: "2026-02-04"
updatedAt: "2026-02-08"
tags:
  - Vercel
  - 部署
  - Checklist
---

## 必备环境变量

至少配置站点地址、Giscus 参数和 Upstash Redis 凭据。

## 发布前验证

执行 typecheck 与 build，确保生产构建零报错。
