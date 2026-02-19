---
title: "CB Chat UI 架构"
excerpt: ""
date: "2026-02-19"
tags:
  - 未分类
---

# CB Chat UI 架构

本文件梳理新版 Chat UI 的目标、组件划分、配置接口以及与 ACP 协议的衔接方式，供 Session Wrapper 或宿主项目接入时参考。

## 1. 背景与目标
- 旧版实现将消息渲染、输入逻辑和数据请求耦合在一起，难以嵌入 IDE/独立应用。
- 新版 Chat UI 只输出纯受控的 React 组件：所有状态和副作用由外部 Session Wrapper 管理，UI 不再监听服务或操作存储。
- UI 需要遵循 [Agent Client Protocol (ACP)](https://agentclientprotocol.com/overview/introduction) 的 turn 与工具语义，同时兼容 Genie 现有的 chat-sdk 模型。

目标概括如下：
1. 对外暴露一个 `CBChat` 组件，props 完全受控。
2. 可插拔的输入能力（模型/模式/mention/额外操作/集成等）。
3. MessageTimeline 支持自定义 renderer、流式高亮、typing indicator。
4. Session Wrapper 负责与 ACP 和旧服务沟通，并将数据转换成 UI props。

## 2. 组件拆分
```
CBChat
├─ MessageTimeline (纯渲染)
│   • props: MessageTimelineConfig
│   • 默认支持 Text/Reasoning/Tool-Call、流式状态、messageActions
├─ InputView (纯渲染)
│   • props: CBInputProps (模型、模式、mention、集成、additional actions…)
└─ 其它插槽: emptyState、typingIndicators、bottom extra 等
```
- MessageTimeline 根据 `messages`/`streamingMessageId` 等受控数据渲染消息气泡；可以传入 `messageRenderers`、`assistantContentRenderers` 覆盖默认输出。
- InputView 只负责展示输入框和工具栏；所有交互（发送、取消、附件、mention、模型切换等）通过回调抛给 Session Wrapper。

## 3. Props 总览
- `CBChatProps`
  - `controller: CBChatController` (`sendPrompt` / `cancelPrompt` / 可选模式、模型更新）
  - `sessionId: string`
  - `messages`, `input`, 以及可选的显式配置（emptyState、typingIndicators 等）
- `CBInputProps`
  - `modelSelector?: ModelSelectorProps`
  - `modeSwitcher?: ModeSwitcherProps`
  - `additionalActions?: AdditionalActionConfig`
  - `integrations?: IntegrationsConfig`
  - `mentionConfig?: MentionConfig`
  - `enhancePromptConfig?`, `planModeConfig?` 等
- `MessageTimelineConfig`
  - `messages`, `activeTurnId`, `streamingMessageId`, `typingIndicators`
  - `messageRenderers`, `assistantContentRenderers`, `messageActions`
  - `onMessageClick`, `onRetry`, `onScrollTopReached`, `onScrollBottomReached`

所有类型定义集中在 `src/types` 目录（如 `chat.ts`、`message-timeline.ts`、`mention.ts` 等文件），并带有注释说明。

## 4. Mention 与附加操作
- Mention：使用 `MentionConfig` + `MentionProviderConfig`。库内提供 `createFileMentionConfig`、`createGitMentionConfig`、`createTerminalMentionConfig`、`createRuleMentionConfig` 等工厂，只需传入最小的 fetch/回调即可复用原行为。
- 附加操作（原 “+” 菜单）：`AdditionalActionConfig` 支持 `action`、`submenu`、`trigger` 三种 Item。默认工厂 `createDefaultAdditionalActions` 复用“本地文件/Figma/库”选项，也可自定义渲染。
- 集成服务：`IntegrationsConfig` 描述分组、刷新、设置、选择回调，Wrapper 负责转换旧的 `IntegrationItem`。

## 5. Session Wrapper 职责
1. **状态管理**：手握 `messages`、`streamingMessageId`、`typingIndicators` 等状态，每当收到 ACP `session/update` 或旧服务通知时更新并传给 UI。
2. **协议转换**：`InputValue + ChatSelectionContextInfo[]` → ACP `PromptRequest`；`SessionNotification` → `Message[]`。
3. **业务桥接**：模型/模式切换、plan 模式、额外操作、集成菜单等，都在 Wrapper 内调用旧服务或 ACP 接口；UI 只显示结果。
4. **灰度与回退**：通过 feature flag 控制是否启用新组件，出现问题时可以落回旧实现。

## 6. ACP Prompt 映射

以下内容整合自旧文档 `acp-mapping.md`，说明如何将输入数据装配为 ACP `PromptRequest`。

### 6.1 架构示意
```
InputValue + ChatSelectionContextInfo[]
        │
        ▼
buildPromptRequest()
├─ 构造 ContentBlock[]            (文本、resource/resource_link)
├─ 填充 sessionId                 (ACP Session)
└─ 可选 _meta                     (requestId / contexts 等最小信息)
        │
 sendPrompt(PromptRequest)
```

Session Wrapper 需要维护旧 `conversationId` 与 ACP `sessionId` 的映射，处理模式/模型同步。

### 6.2 字段映射表
| 旧结构 (`ChatAgentRequest`)             | ACP `PromptRequest` / 补充说明                                                  |
|----------------------------------------|---------------------------------------------------------------------------------|
| `conversationId`                       | 映射为 `sessionId`。                                                            |
| `requestId`                            | 保存在 `_meta.requestId`（用于回传匹配）。                                     |
| `prompt: string`                       | 编成 `ContentBlock[]`（文本块 + 引用）。                                       |
| `inputPhrase`                          | 保存在 `_meta.inputPhrase`，供 Agent 解析 `/command` 等。                      |
| `selectionContexts`                    | 转换为 `ContentBlock::resource` / `resource_link`，或保存在 `_meta.contexts`。 |
| `agent` / `command` / `model` / ...    | 由 Session Wrapper 另行调用 `session/set_mode`、`session/set_model` 或扩展 RPC。|

### 6.3 ContentBlock 组装
- 主文本 → `ContentBlock::text`，并把 `input.phrases` 放在 `_meta.phrases`；
- 文件/终端/git 等上下文 → `resource` / `resource_link`，视是否有实际 URI；
- 无法直接映射的上下文 → 写入 `_meta.contexts` 留给 Agent 自定义解析。

### 6.4 `_meta` 建议
保持精简：`{ requestId, inputPhrase, contexts }` 足够；复杂业务字段请通过 ACP 标准接口或扩展 RPC 同步。

### 6.5 Mode / Model 同步
- Session Wrapper 在 UI 切换模式/模型时调用 `session/set_mode`、`session/set_model`；自动化开关等也在 Wrapper 内处理。

### 6.6 Session Wrapper 示例
详见 `src/types/chat.ts` 中 `CBChatController` 说明，伪代码示例如下：
```ts
export function createLegacyController(...) : CBChatController {
  return {
    async sendPrompt(request) {
      const legacy = toLegacyRequest(request, conversationId);
      await chatInputController.sendRequest({
        inputText: legacy.prompt,
        inputPhrase: legacy.inputPhrase,
        contexts: legacy.selectionContexts,
        agentName: legacy.agent,
        command: legacy.command,
        chatType: legacy.chatType,
      });
    },
    cancelPrompt() {
      return chatInputController.stopRequest(conversationId);
    },
  };
}
```
`toLegacyRequest`/`fromLegacyMessage` 负责在 ACP 与旧结构之间互转，示例见 `mention-plan.md` 与 `src/types/message-timeline.ts` 的注释；消息数组仍由外层收集后作为 `messageConfig.messages` 传给 UI。

---

通过上述约定，CB Chat UI 保持了“受控 props + 外部 Wrapper”的模式，既可以快速复用旧逻辑，又能逐步切换到 ACP 协议，后续扩展（新的 mention、工具卡片、集成入口等）也只需在配置层新增工厂或回调即可。
