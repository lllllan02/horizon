---
title: "Codex：从 rollout 恢复会话"
parent: agent-checkpoint-recovery
category: "Agent"
tags: ["Agent", "Checkpoint", "持久化", "源码阅读"]
learning_status: pending
created_at: "2026-10-19 19:27:21"
updated_at: "2026-10-19 19:27:21"
source:
  - "https://learn.chatgpt.com/docs/app-server"
  - "https://github.com/openai/codex/blob/97239fd052db455bd08c41afcdab738e0fe83b87/codex-rs/history/src/lib.rs"
  - "https://github.com/openai/codex/blob/97239fd052db455bd08c41afcdab738e0fe83b87/codex-rs/history/src/rollout_payload.rs"
  - "https://github.com/openai/codex/blob/97239fd052db455bd08c41afcdab738e0fe83b87/codex-rs/rollout/src/recorder.rs"
  - "https://github.com/openai/codex/blob/97239fd052db455bd08c41afcdab738e0fe83b87/codex-rs/rollout/src/policy.rs"
  - "https://github.com/openai/codex/blob/97239fd052db455bd08c41afcdab738e0fe83b87/codex-rs/protocol/src/protocol.rs"
  - "https://github.com/openai/codex/blob/97239fd052db455bd08c41afcdab738e0fe83b87/codex-rs/protocol/src/models.rs"
  - "https://github.com/openai/codex/blob/97239fd052db455bd08c41afcdab738e0fe83b87/codex-rs/core/src/session/rollout_reconstruction.rs"
---

**「Codex 将会话历史与运行所需元数据持久化，恢复时重建上下文，再继续后续工作。」** 这条路径可借鉴为 Agent 的恢复设计，但不能据此认为正在执行的命令、网络请求或任意代码位置都能恢复。

本文节选公开 CLI／App Server 的会话持久化实现；源码固定为 `97239fd052db455bd08c41afcdab738e0fe83b87`，官方文档按 2026-10-19 核对。未启动 Codex 做故障恢复实验，也不将此实现外推为 Codex Cloud 的全部内部机制。

## rollout 保存了什么？

[RolloutItem 与编码结构](https://github.com/openai/codex/blob/97239fd052db455bd08c41afcdab738e0fe83b87/codex-rs/history/src/rollout_payload.rs)把不同种类的记录写入同一条历史。每行包含时间、记录类型和 payload，某些记录另有序号或 metadata。与本题直接相关的内容包括：

| 记录 | 内容与恢复作用 |
| --- | --- |
| `session_meta` | 线程／会话身份、工作目录、来源、CLI 版本、基础指令、动态工具等；建立会话基础信息 |
| `turn_context` | 本轮模型、工作目录、审批与沙箱策略等；恢复上下文基线与相关设置 |
| `response_item` | 用户和模型消息、工具调用、工具结果等；保留模型已看到的输入和已生成的输出 |
| `compacted` | 压缩消息及可选的替代历史和恢复元数据；重建当前有效上下文时处理压缩边界 |
| `event_msg` 等 | 按持久化策略保留的事件与用量等记录；补充回合状态和展示信息 |

工具请求与结果通过 `call_id` 关联，`function_call.arguments` 保存为 **「包含 JSON 的字符串」**；不能在解释样例时把它误写成已经解析的对象。[持久化策略](https://github.com/openai/codex/blob/97239fd052db455bd08c41afcdab738e0fe83b87/codex-rs/rollout/src/policy.rs)还会筛选记录，并对部分展示事件的大输出做截断，因此 rollout 也不是所有运行数据的无损进程快照。

## 保存后长什么样，怎样读回？

[[assets/codex-rollout-example.txt|教学 rollout JSONL]]依据该提交的结构编写：包含会话元数据、本轮配置、用户消息、读文件调用、对应结果、回答，以及一条展示压缩结构的记录。业务内容与 ID 均为自拟，**「不是实际会话导出，也不是可直接导入的完整官方运行记录」**；压缩记录仅演示格式，不代表这段短对话会触发自动压缩。文件使用 `.txt` 以兼容附件预览，内容每行是一个 JSON 对象。

[Recorder](https://github.com/openai/codex/blob/97239fd052db455bd08c41afcdab738e0fe83b87/codex-rs/rollout/src/recorder.rs)序列化记录、追加换行并写入 JSONL；加载时解析为历史记录。[会话重建](https://github.com/openai/codex/blob/97239fd052db455bd08c41afcdab738e0fe83b87/codex-rs/core/src/session/rollout_reconstruction.rs)处理压缩、回退等边界，恢复有效消息和上下文基线；不能简单把所有文本重新拼成一个提示词。

[App Server](https://learn.chatgpt.com/docs/app-server)通过 `thread/resume` 重新打开已保存的线程，后续通过 `turn/start` 继续；线程 ID 是定位句柄。官方文档还明确区分历史回退与本地文件：`thread/revert` 不修改文件。**「恢复会话、恢复工作区、恢复外部操作是不同职责」**；这一点也适用于[[claude-code-checkpoints|Claude Code 的会话与文件恢复]]。
