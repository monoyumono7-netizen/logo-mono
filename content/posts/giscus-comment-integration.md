---
title: "Giscus 评论系统集成指南"
excerpt: "把 GitHub Discussions 变成博客评论区，并自动适配暗黑模式。"
date: "2026-02-08"
updatedAt: "2026-02-11"
tags:
  - Giscus
  - 评论
  - GitHub
---

## Discussion 映射策略

推荐使用 `pathname`，可以稳定映射每篇文章。

## 主题同步

监听系统主题变化，并通过 `postMessage` 通知 Giscus iframe。
