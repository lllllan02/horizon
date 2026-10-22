---
title: "长期记忆的内容选择：Claude Code 与 Letta"
parent: agent-memory
category: "Agent"
tags: ["Agent", "记忆"]
learning_status: pending
created_at: "2026-10-22 16:24:28"
updated_at: "2026-10-22 16:29:48"
source:
  - "https://code.claude.com/docs/en/memory#auto-memory"
  - "https://docs.letta.com/configuration/memory#teach-your-agent"
---

**Claude Code 强调保存未来会话有用、无法从代码直接获得的协作背景；Letta 强调提取关于用户和工作的持久信息，并整理可复用的经验。** 两者都支持选择性提取，但具体保存范围不同。本文节选 2026-10-22 官方文档中的内容选择建议，未测试实际提取效果。

## Claude Code：补足代码之外的协作背景

[Auto memory](https://code.claude.com/docs/en/memory#auto-memory)明确列出四类记录：

| 类型 | 官方描述的内容 |
| --- | --- |
| `user` | 用户的角色、专业程度与工作偏好 |
| `feedback` | 用户给出的纠正，以及用户确认有效的方法 |
| `project` | 进行中的工作、截止期，以及无法从代码或 Git 历史得知的决定 |
| `reference` | 项目外信息的位置，例如问题跟踪系统或看板 |

选择依据是**未来对话是否有用**，并非每次会话都保存。文档明确跳过可从代码获得的架构、文件路径、调试修复，以及 `CLAUDE.md` 已有的内容；[两类机制的对照](https://code.claude.com/docs/en/memory#claudemd-vs-auto-memory)将显式规则与自动积累的偏好、纠正和项目背景分开。

这套建议的重点是避免重复记录已有信息。不能据此说 Claude Code 会自动把每次修 Bug 都保存成经验，也不能把它的排除项推广为所有 Agent 的统一限制。

## Letta：提取持久知识，整理有用经验

[Teach your agent](https://docs.letta.com/configuration/memory#teach-your-agent)说明，Agent 学到具有持续价值的信息时更新记忆；用户也可明确要求保存。官方示例是「在这个仓库始终使用 pnpm」，同时给出了做法与仓库范围，而非记下当前一条命令。

[Dreaming](https://docs.letta.com/configuration/memory#dreaming)由后台 Agent 回看近期对话，整理有用经验并更新记忆。[存储建议](https://docs.letta.com/configuration/memory#cloud-memory-storage)则要求把大型数据集、归档、媒体和项目文件放在其他位置，记忆中保留简短摘要与取用链接。这里支持的是提炼知识和线索，未规定所有记忆都必须永久有效，也未证明提取一定准确。

## 怎样借鉴这些建议

**用户和项目说明信息的对象与适用范围，经验说明信息的内容，两者可以交叉。** 用户的协作要求、项目的背景与约束都值得按需保存；从反馈和执行结果中提炼的做法与教训，也分别有用户或项目范围，不能把「用户、项目、经验」当作同一维度的三个并列类别。

[[langgraph-memory#内容怎样组织？|LangGraph 的事实、经历与做事规则分类]]关注内容本身：分别保存已知事实、过去发生的事件与行动、指导行为的规则。它与按用户或项目划定范围是不同视角。经历可以供后续任务参考，不等于已经证明其中的方法普遍成立。
