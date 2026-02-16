---
title: "基于 Upstash 的无后端阅读量统计"
excerpt: "用 Redis REST API 实现阅读数统计与防刷，隐私友好可上线。"
date: "2026-02-06"
updatedAt: "2026-02-10"
tags:
  - Upstash
  - Redis
  - Analytics
---

## 计数策略

每篇文章维护 `views:slug` 计数键。

## 防刷策略

把 IP 和 UA 哈希后写入短期节流键，命中则不再递增。
