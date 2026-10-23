---
title: "多 Agent 协作"
aliases: ["多智能体协作", "Multi-Agent Systems", "MAS"]
parent: agent
category: "Agent"
tags: ["Agent", "多Agent协作", "工程选型"]
learning_status: organized
created_at: "2026-10-13 17:41:05"
updated_at: "2026-10-21 14:00:28"
reading_suggestions:
  - multi-agent-orchestration
  - multi-agent-organization
learning_status_changed_at: "2026-10-21 14:03:42.286"
---

**多 Agent 协作是让多个 Agent 分工执行，通过成果回传、交接或消息交换完成共同目标。**

需要并行调查独立方向，或隔离大量中间资料时，可以考虑多 Agent，判断重点有两点：

1. **能否独立交付**：[[agent-task-decomposition#怎么拆？|拆分任务]]后，输入、范围和产物应当清楚，成果能单独核验，执行中不必频繁确认；有依赖时等前置输入具备后再启动。[[claude-code-agent-collaboration#何时委派，何时留在主会话？|适合子 Agent 的工作]]包括隔离大量过程输出、使用专用工具与权限，以及自包含的任务。
2. **收益是否覆盖成本**：独立分支并行可以减少等待，过程资料留在子 Agent 可以减轻主上下文负担，串行委派也有隔离收益；但会增加启动、交代上下文、沟通、汇总、验收和返工成本。[[anthropic-multi-agent-research|研究系统的经验]]表明，强依赖、频繁共享上下文的任务较难获益。

[[codex-subagents#源码怎样判断委派价值？|Codex 的 V1 源码指引]]优先委派主 Agent 能同时推进其他工作的分支；下一步立即依赖结果的短任务，留在主 Agent 往往更合适。这是委派策略，不是所有系统的固定规则。

![[assets/multi-agent-delegation.png|640]]

仅需专业指令时可用 [[agent-loading|Skill]]，固定步骤可用[[agent-vs-workflow|工作流]]编排。实际是否受益，要用同批任务、相同预算[[agent-evaluation|比较质量、耗时与成本]]。

确定采用多 Agent 后，再安排[[multi-agent-organization|任务委派、执行中协调与通信，以及并发冲突的处理方式]]。具体执行由[[multi-agent-orchestration|多 Agent 编排]]组织。
