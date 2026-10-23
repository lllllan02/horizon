---
title: "多 Agent 的信息与成果传递"
parent: multi-agent-orchestration
type: overview
category: "Agent"
tags: ["Agent", "多Agent协作", "上下文管理"]
learning_status: organized
created_at: "2026-10-22 14:41:09"
updated_at: "2026-10-23 22:43:08"
learning_status_changed_at: "2026-10-23 22:45:45.500"
---

**多 Agent 的信息与成果传递，是将任务、发现和工作结果交给其他成员使用的过程。** 成员需要接续工作时，要约定怎样交付数据、带上哪些内容，以及接收方何时处理。实际调用、收发和读写由程序执行，模型可通过工具提出请求。

## 信息通过什么传递

| 交付方式 | 数据怎样交给对方 |
| --- | --- |
| [[langchain-multi-agent#具体怎样实现？\|调用与返回]] | 传入任务，再沿本次调用取得选定的返回成果。 |
| [[multi-agent-message-passing\|消息传递]] | 投递给接收成员，由它的运行程序安排读取和处理。 |
| [[multi-agent-shared-state\|共享状态]] | 写入共同记录，其他成员通过检查或通知发现更新后读取。 |

![[assets/multi-agent-communication-methods.png|640]]

**这些方式可以组合。** 例如，用调用委派任务、用共享状态保存成果，再用消息通知其他成员读取。谁持续负责、谁接手后续任务，仍由[[multi-agent-collaboration-patterns|协作与控制模式]]约定。

需要模型处理的数据，仍须进入接收成员的[[agent-context-input|本轮输入]]。**数据送达、任务完成和成果通过验收，需要分别判断。**
