---
title: "多 Agent 的协作与控制模式"
aliases: ["Multi-Agent Collaboration Patterns"]
parent: multi-agent-orchestration
category: "Agent"
tags: ["Agent", "多Agent协作"]
learning_status: organized
created_at: "2026-10-23 16:29:20"
updated_at: "2026-10-23 16:47:15"
learning_status_changed_at: "2026-10-23 16:50:41.603"
---

**协作与控制模式是约定多个 Agent 怎样分工、谁持续负责，以及谁接续处理任务的组织方式。** 在[[multi-agent-orchestration|多 Agent 编排]]中，需要根据中间成果调整任务，或让成员利用彼此的发现时，这些约定让分工与后续处理衔接起来。

本篇关注「**成员怎样分工、谁决定后续处理**」；[[multi-agent-flow-patterns|流程模式]]关注任务怎样推进。交接与顺序流水线虽然都可能画成 `A → B`，这里要辨认的是处理权是否转移，不能仅由步骤先后推定协作关系。

下面从[[multi-agent-orchestration-sources|持续协调、接手处理与共同讨论]]观察成员关系；这些方式可以组合，并非互斥分类。图中的成员数量仅作示意。

![[assets/multi-agent-collaboration-patterns.png|640]]

- **主管与执行者（Supervisor / Manager）**：主管分配子任务、收取成果，再决定补查或汇总。适合需要统一约束与综合判断的任务，依赖主管的分解与核验能力。把[[langchain-multi-agent#具体怎样实现？|子 Agent 包装成工具]]调用，就是「**Agent 作为工具（Agents as Tools）**」：专家返回成果，主管继续负责。

- **控制权交接（Handoff）**：A 把后续处理权交给 B，由 B 接续任务或对话。适合需要切换专业角色的阶段，重点是「**谁接手后续处理**」；须避免来回转交却无人完成。它与工具式调用后返回主管的控制关系不同。

- **群组对话（Group Chat）**：多个成员在共享会话中轮流贡献，回应已有讨论。适合需要讨论或共同修订的任务；须选择发言者、控制上下文与结束条件，也可以由协调者主持。

主管模式还可向下嵌套：成员 A 接收上层任务后，又向 A1、A2 分派，因而「**对上是执行者，对下是主管**」。这就是[[multi-agent-orchestration-sources#Google ADK：分派、分解与反馈|ADK 所称的层级任务分解（Hierarchical Task Decomposition）]]在逐层委派、成果返回结构中的表现。它适合仍需细分的复杂任务，同时增加信息压缩与协调成本；父／子 Agent 表示相对创建或嵌套关系，不代表能力等级。

**动态任务分解（Orchestrator–Workers）强调按具体输入临时形成子任务，再分发和综合。** 它可以由主管实现，也可继续嵌套为多层；与预先写好的固定分支相比，区别在于子任务需要当场确定。

这些模式可以组合，也能采用不同的执行流程：主管既可依次调用专家，也可并行委派，或按输入路由到合适的专家。「任务委派（Task Delegation）」只是交出工作的宽泛说法，仍须看成果返回谁、后续处理由谁负责。
