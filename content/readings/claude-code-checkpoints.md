---
title: "Claude Code：会话接续与文件检查点"
parent: agent-checkpoint-recovery
category: "Agent"
tags: ["Agent", "Checkpoint", "持久化"]
learning_status: pending
created_at: "2026-10-19 19:27:21"
updated_at: "2026-10-19 19:27:21"
source:
  - "https://code.claude.com/docs/en/how-claude-code-works#work-with-sessions"
  - "https://code.claude.com/docs/en/checkpointing"
  - "https://code.claude.com/docs/en/agent-sdk/file-checkpointing"
---

**「Claude Code 用会话历史支持接续，用文件检查点支持撤销编辑；两者配合保留任务上下文和工作成果。」** 用户界面的 rewind 可以选择回退会话、代码或两者，但它与框架保存调度状态的 Checkpoint 并不等价。

本文按 2026-10-19 的官方文档节选公开行为与 SDK 入口；未读取私人会话、未运行 Claude Code，也未核实其内部文件备份索引的磁盘格式。

## 会话恢复保存什么？

[会话说明](https://code.claude.com/docs/en/how-claude-code-works#work-with-sessions)写明：消息、工具使用与结果随工作保存为 `~/.claude/projects/` 下的明文 JSONL。`claude --continue` 或 `claude --resume` 重新打开原会话并追加消息；fork 则复制历史到新的会话 ID。

这解释了为什么只保存最后一段回答不够：模型还需要用户要求、已观察的结果和前面的上下文。工作目录中的当前文件仍是另一份状态；切换代码分支不会自动把会话历史也改成新分支的历史。

## 文件检查点保存什么？

[Checkpointing 文档](https://code.claude.com/docs/en/checkpointing)与 [SDK 文件回退文档](https://code.claude.com/docs/en/agent-sdk/file-checkpointing)说明，文件编辑前会保留备份，用户消息的 UUID 可作为回退点。回退会恢复被修改文件，并删除回退点之后被工具创建的文件。

由此可以把文件恢复所需信息理解为 **「回退点、文件路径、当时是否存在，以及修改前内容」**。这是对恢复需求的归纳，官方文档没有在这些页面承诺统一的 JSON 备份清单格式。

[[assets/claude-checkpoint-example.json|应用保存的恢复句柄与文件备份示意]]分别展示两部分：应用可以保存的 `session_id`／`checkpoint_id`，以及为理解文件回退而自拟的备份清单。清单字段并非 Claude Code 内部字段，ID 也不是实际捕获的值。**「两个 ID 只是句柄，仍须保有对应会话和备份数据」**。

SDK 的公开流程是开启 `enableFileCheckpointing`，通过 `replay-user-messages` 获取 user 消息的 `uuid`；稍后按 session ID resume，在响应循环内调用 `rewindFiles(uuid)`。该 SDK 方法只回退文件，保持会话历史；交互界面的 rewind 菜单另行支持回退会话。

## 哪些工作不能靠它恢复？

跟踪范围主要是 `Write`、`Edit`、`NotebookEdit`，Bash 命令造成的文件变化、远端 API 和数据库效果不受其保证；其他并发编辑和子 Agent 编辑也有跟踪限制。因此它不能代替 Git、外部操作幂等或完整的执行状态恢复。[[eino-checkpoints|Eino 的中断状态与恢复地址]]回答的是另一个问题：程序怎样找到并重新进入待处理组件。
