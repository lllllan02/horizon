---
title: "多 Agent 的编排"
parent: agent
type: overview
category: "Agent"
tags: ["Agent", "多Agent协作", "上下文管理"]
learning_status: organized
created_at: "2026-10-22 13:27:49"
updated_at: "2026-10-23 23:17:09"
learning_status_changed_at: "2026-10-23 23:24:05.539"
---

多个 Agent 共同完成任务时，需要决定任务怎样拆分、成员怎样衔接，以及信息和结果怎样影响下一步。**编排（Orchestration）是组织多个 Agent 执行、信息流转与控制流程的方式。** 是否值得增加成员，仍取决于[[multi-agent-benefits|分工收益与协调成本]]。

编排可由模型根据进展决定流程，也可由程序预先规定，或将[[multi-agent-study-sources#OpenAI Agents SDK：编排与控制权|两者组合使用]]；如何选择取决于[[agent-vs-workflow|任务步骤能否预先确定]]。

**同一套编排可以从三个维度理解，相关模式可以嵌套组合。** 对照[[multi-agent-orchestration-sources|各框架的模式说明]]时，也需要分别判断：

| 观察维度 | 关心的问题 |
| --- | --- |
| [[multi-agent-flow-patterns\|流程模式]] | 任务怎样按依赖、分支、汇合与反馈推进？ |
| [[multi-agent-collaboration-patterns\|协作与控制模式]] | 谁持续负责、谁接手，成员怎样联系与分层委派？ |
| [[multi-agent-communication\|信息与成果传递]] | 交换哪些内容、怎样送达，接收方实际读到什么？ |

同样的 `A → B`，可以表示 B 依赖 A 的成果，也可以表示 B 接手后续处理；[[langchain-multi-agent#具体怎样实现？|主管先调用 A 再调用 B]]，也能保留整体责任。**执行顺序与控制权需要分别判断。**

流程还可加入[[multi-agent-flow-patterns#反馈怎样决定继续与结束|评估与改进循环]]，依据核验反馈继续修订或结束；需要人补充信息、确认判断或批准操作时，通过[[agent-human-in-the-loop|人工介入]]暂停相关工作，取得回复后再继续处理。
