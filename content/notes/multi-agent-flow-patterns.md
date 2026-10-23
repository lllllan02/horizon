---
title: "多 Agent 的流程模式"
aliases: ["Multi-Agent Flow Patterns"]
parent: multi-agent-orchestration
category: "Agent"
tags: ["Agent", "多Agent协作", "工作流"]
learning_status: organized
created_at: "2026-10-22 17:16:55"
updated_at: "2026-10-23 16:47:15"
learning_status_changed_at: "2026-10-23 16:50:34.843"
---

**流程模式是组织任务执行顺序、分支选择与成果汇合的结构。** 在[[multi-agent-orchestration|多 Agent 编排]]中，按任务依赖选择流程，可以减少不必要的等待和调用。

本篇关注「**任务怎样推进**」；[[multi-agent-collaboration-patterns|协作与控制模式]]关注成员怎样分工、谁决定后续处理。顺序流水线与交接都可能画成 `A → B`，但前者表达步骤依赖，后者表达处理权转移，不能只凭图形相似将两者归为同一类。

[[multi-agent-orchestration-sources#LangGraph：从固定依赖走向动态分工|常见的三种基础模式]]分别处理前后依赖、独立分支与路径选择：

![[assets/multi-agent-flow-patterns.png|640]]

- **顺序流水线（Sequential Pipeline）**：前一步完成后，把成果交给下一步。适合有明确前后依赖的任务，重点是「**谁需要等谁**」。

- **并行分发与汇合（Parallel Fan-out/Fan-in）**：多个分支独立执行，再收集结果进行综合或选择。适合彼此不依赖的子任务或多视角分析，重点是「**哪些工作能同时做**」。

- **路由（Routing）**：按输入选择一个或多个处理分支。适合类别可区分、需要不同专业能力的请求，重点是「**这次需要谁参与**」；图中的退款请求只选中退款处理。

三者可以组合：先路由选出需要的分支，再并行执行独立任务，汇总后顺序进入下一阶段。流程节点也可以是函数或一次模型调用；多个节点不一定就是多个 Agent。
