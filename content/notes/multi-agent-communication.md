---
title: "多 Agent 的信息与成果传递"
parent: multi-agent-orchestration
type: overview
category: "Agent"
tags: ["Agent", "多Agent协作", "上下文管理"]
learning_status: reading
created_at: "2026-10-22 14:41:09"
updated_at: "2026-10-23 19:54:46"
learning_status_changed_at: "2026-10-22 15:18:12.027"
---

**多 Agent 的信息传递包含两步：程序交付数据，再将内容放进接收成员的模型输入。** 在[[multi-agent-orchestration|多 Agent 编排]]中，模型可提出工具调用，程序执行实际的收发与读写。

![[assets/multi-agent-communication-methods.png|640]]

## 信息通过什么传递

- **调用与返回**：调用参数传入任务，子 Agent 的输出作为工具结果交回。[[langchain-multi-agent#具体怎样实现？|工具包装]]决定交付哪些内容。
- **[[multi-agent-message-passing|消息传递]]**：程序按规则触发，或模型通过工具提出发送请求，再由程序投递、接收并交给模型处理。Channel、HTTP、消息队列是其中的投递实现。
- **[[multi-agent-shared-state|共享状态]]**：以 LangGraph 的节点增量与 ADK 的会话状态为例，说明共享哪些字段、何时应用更新、后续成员怎样读取，以及并发合并的边界。

三者可以组合：主管用工具委派 A、B，成员通过消息交流，同时把证据写入共享记录。图中的箭头表示数据流转；谁持续负责、谁接手任务，另由[[multi-agent-collaboration-patterns|协作与控制模式]]约定。

## 数据送到了，怎样接回任务

数据都要按需进入接收成员的[[agent-context-input|上下文]]。交任务保留目标、约束和预期输出；交成果保留结论、出处、条件与缺口，并标明完成、失败或待补充。

**数据送达、任务完成、成果通过验收，需要分别判断。** 后台调用只返回编号时，还须取得实际结果；收到结果后，负责人再按任务标准验收。
