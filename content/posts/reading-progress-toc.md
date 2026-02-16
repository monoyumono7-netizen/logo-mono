---
title: "阅读进度条与目录交互实现"
excerpt: "使用原生 React 与 IntersectionObserver 打造沉浸式阅读体验。"
date: "2026-02-07"
updatedAt: "2026-02-07"
tags:
  - React
  - TOC
  - UX
---

## 进度条算法

读取滚动距离和最大可滚动高度，计算百分比。

## 当前章节高亮

利用 IntersectionObserver 追踪进入视口的 heading。
