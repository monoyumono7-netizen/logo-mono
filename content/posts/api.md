---
title: "CB Chat UI API 参考"
excerpt: ""
date: "2026-02-19"
tags:
  - 未分类
---

# CB Chat UI API 参考

本文档汇总 `@genie/cb-chat-ui` 暴露的主要组件、属性与类型，便于在宿主项目中查阅。所有配置均为受控模式：UI 组件不会自行拉取或缓存数据，调用方需要通过 props 提供状态与回调。

## 导出组件

### `CBChat`
- 位置：`genie/packages/cb-chat-ui/src/components/cb-chat.tsx`
- 作用：组合消息时间线与输入区的顶层组件。
- Props（来自 `CBChatProps`）：
  | 名称 | 类型 | 说明 |
  | --- | --- | --- |
  | `controller` | `CBChatController` | UI 调用的命令接口。必须实现 `sendPrompt` / `cancelPrompt`，可选实现 `setSessionMode` / `setSessionModel`。|
  | `sessionId` | `string` | 当前会话的 ACP `sessionId`。UI 仅用于透传；会话状态仍由宿主维护。|
  | `messageConfig` | `MessageTimelineConfig` | 消息时间线的受控配置（消息数组、渲染器、交互回调等）。|
  | `inputProps` | `CBInputProps` | 输入框相关的受控配置（模式切换、模型选择、mention、集成菜单等）。|

### `ChatInput`
- 位置：`genie/packages/cb-chat-ui/src/components/chat-input.tsx`
- 作用：受控输入区域，可单独嵌入现有页面。
- Props：`CBInputProps & { onSubmit?: (text: string) => void; disabled?: boolean; }`
  | 名称 | 类型 | 说明 |
  | --- | --- | --- |
  | `onSubmit` | `(text: string) => void` | 触发发送时调用。通常由 `CBChat` 注入，用于转发到 controller。 |
  | `disabled` | `boolean` | 统一禁用输入（例如发送中）。 |
  | 其余字段 | `CBInputProps` | 见下节。 |

### `MessageTimeline`
- 位置：`genie/packages/cb-chat-ui/src/components/message-timeline.tsx`
- Props：`MessageTimelineConfig`
  | 名称 | 类型 | 说明 |
  | --- | --- | --- |
  | `messages` | `ReadonlyArray<Message>` | 会话消息列表（来自 `@genie/chat-sdk`）。 |
  | `assistantContentRenderers` | `Partial<Record<AssistantMessageContentType \| string, AssistantContentRenderer>>` | 覆盖默认的助手消息内容渲染逻辑（文本、tool-call、自定义类型等）。 |
  | `messageRenderers` | `Partial<Record<Message['messageType'], MessageRenderer>>` | 覆盖特定消息类别（user/assistant/system/…）的气泡渲染。 |
  | `typingIndicators` | `ReadonlyArray<TypingIndicator>` | 正在输入指示。 |
  | `streamingMessageId` | `string` | 当前流式消息，用于高亮。 |
  | `highlightedMessageId` | `string` | 需要额外强调的消息。 |
  | `onMessageClick` / `onRetry` / `onScrollTopReached` / `onScrollBottomReached` | `(...args) => void` | 交互回调，宿主可在其内部调用 `controller` 或其它服务。 |
  | 其他字段 | 见 `MessageTimelineConfig` 定义。 |

## 控制器接口

### `CBChatController`
源于 `genie/packages/cb-chat-ui/src/types/chat.ts`。

| 方法 | 参数 | 说明 |
| --- | --- | --- |
| `sendPrompt(request)` | `PromptRequest` | 必须实现。将输入数据发送给 Agent；可在适配层完成 ACP ↔︎ 旧协议转换。 |
| `cancelPrompt(request)` | `CancelNotification` | 必须实现。用于终止流式任务或长耗时调用。 |
| `setSessionMode(options)` | `{ sessionId: string; mode: string }` | 可选。模式切换时由 UI 触发，宿主可桥接旧 `session/set_mode`。 |
| `setSessionModel(options)` | `{ sessionId: string; modelId: string }` | 可选。模型选择器变化时调用，宿主负责真正的模型切换。 |

> 提示：`CBChat` 内部默认只调用 `sendPrompt`；其它方法需在回调（如 `onModeChange`）里手动触发以保持状态同步。

## 输入区配置（`CBInputProps`）
定义见 `genie/packages/cb-chat-ui/src/types/chat.ts`。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `mentionConfig` | `MentionConfig` | Mention 相关配置。传入后渲染 `@` 面板，可用工厂函数快速构建。|
| `additionalActions` | `AdditionalActionConfig` | “+” 菜单的行为配置（action/submenu/trigger 三类 item）。|
| `integrations` | `IntegrationsConfig` | 接入卡片配置（分组、刷新、设置、选择回调等）。|
| `planModeConfig` | `{ disabled?: boolean; isPlaning?: boolean; onPlanModeChange(value: boolean): void; }` | 计划模式开关，UI 只负责按钮状态，逻辑需走回调。|
| `onModeChange` | `(mode: string) => void` | 模式切换（craft/ask…）。通常在回调里调用 `controller.setSessionMode` 并更新 `selectedMode`。|
| `selectedMode` | `string` | 当前模式的受控值。|
| `modelSelector` | `ModelSelectorProps` | 模型选择器选项。包含 `options`, `selectedId`, `onChange`。|
| `enhancePromptConfig` | `{ disabled?: boolean; minTextLength?: number; onEnhance(text: string): Promise<string>; }` | 提示词增强入口配置。返回的新文本会直接写回输入框。|

### `ModelSelectorProps`
- `options`: `ReadonlyArray<ModelOption>`（含 `id`, `label`, `description`, `icon`, `isDefault` 等）。
- `selectedId`: 当前模型 ID。
- `onChange(id: string)`: 用户选择后回调。

### `IntegrationsConfig`
- `sections`: `ReadonlyArray<IntegrationSection>`，每个 section 内含 `IntegrationOption` 列表。
- `onRefresh`: 刷新按钮回调。
- `onOpenSettings`: 打开配置面板。
- `onSelect(option, context?)`: 选择集成或二级操作时触发。
- `isRefreshing`: 受控 loading。

### `AdditionalActionConfig`
- `items`: `ReadonlyArray<AdditionalActionItem>`，支持：
  - `kind: 'action'`：简单按钮，提供 `onSelect`。
  - `kind: 'submenu'`：带二级菜单，通过 `children` 描述。
  - `kind: 'trigger'`：触发自定义面板，提供 `renderPanel(close)`。
- 提供辅助工厂 `createDefaultAdditionalActions`（见 `src/types/additional-actions.ts`）。

### `MentionConfig`
- `providers`: `ReadonlyArray<MentionProviderConfig>`。
- Provider 结构：
  - `trigger`: 触发符号（`@`、`/`…）。
  - `placeholder`: 面板内提示语。
  - `fetchSuggestions(request)`: 返回 `MentionResult`（`suggestions` + 可选 `groups`）。
  - `onSelect(suggestion, request)`: 自定义插入行为。
  - `renderSuggestion`, `footerActions`: UI 扩展点。
- 提供若干工厂函数：`createFileMentionConfig`、`createGitMentionConfig`、`createTerminalMentionConfig`、`createRuleMentionConfig`。

## 消息时间线配置（`MessageTimelineConfig`）
定义见 `genie/packages/cb-chat-ui/src/types/message-timeline.ts`。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `messages` | `ReadonlyArray<Message>` | 必填，消息列表。|
| `activeTurnId` | `string` | 高亮当前 turn。|
| `streamingMessageId` | `string` | 标识正在流式输出的消息。|
| `highlightedMessageId` | `string` | 搜索/定位的目标消息。|
| `typingIndicators` | `ReadonlyArray<TypingIndicator>` | Typing 状态展示。|
| `messageRenderers` | `Partial<Record<Message['messageType'], MessageRenderer>>` | 覆盖整条消息的渲染。|
| `assistantContentRenderers` | `Partial<Record<AssistantMessageContentType \| string, AssistantContentRenderer>>` | 覆盖助手消息每个 content block。|
| `messageActions` | `ReadonlyArray<MessageActionConfig>` | 每条消息的快捷操作（复制、重试等）。|
| `onMessageClick` | `(messageId: string) => void` | 点击消息的回调。|
| `onRetry` | `(messageId: string) => void` | 重试指定消息。通常会转发到 `controller.sendPrompt`。|
| `onScrollTopReached` / `onScrollBottomReached` | `() => void` | 滚动边界回调，可用于分页加载或吸底逻辑。

## 类型导出入口
库统一从 `genie/packages/cb-chat-ui/src/types/index.ts` 导出以下类型：
- `CBChatController`, `CBChatProps`, `CBInputProps`
- `MessageTimelineConfig`, `MessageRenderer`, `AssistantContentRenderer`, `TypingIndicator`
- `MentionConfig` 及相关类型/工厂
- `AdditionalActionConfig` 及相关类型

在源码层面，所有类型通过 `src/types/index.ts` 统一导出；在 monorepo 内可以从 `@genie/cb-chat-ui/types`（或相对路径别名）进行引用。根据你的打包配置，也可以将这些类型与组件一并发布到外部项目。
