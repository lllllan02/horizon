---
title: "父子 Agent 和多 Agent 之间怎么通信？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "多Agent协作"]
learning_status: organized
created_at: "2026-10-19 12:28:23"
updated_at: "2026-10-21 12:46:40"
learning_status_changed_at: "2026-10-21 12:47:43.720"
---

Agent 之间怎么通信，可以先从[[multi-agent-organization|协作方式]]讲起，再说明底下用什么方式传消息。

1. 「**任务委派**」：比如[[parent-agent-interview|父子 Agent]]，父 Agent 通过[[tool-calling|工具调用]]或其他接口创建、调用子 Agent，把任务要求和必要上下文交给它，执行完拿到结果即可。任务能够独立完成时，通常不需要太多中间交互；多个子任务也可以并发执行。

2. 「**并发协作**」：多个 Agent 在执行过程中需要持续交换进度、信息或中间结果。这时还要看有没有主管：**有主管时，各 Agent 把消息和结果交给主管，由主管统一协调；没有主管时，可以通过共享消息或任务中心交换进展，也可以彼此发消息、自行协调。**

这些协作方式可以使用相似的通信机制：**同一进程内用 Channel、内存队列，跨进程、跨服务用消息队列、HTTP 或 gRPC。** 接收方程序处理消息，需要模型理解的内容再加入上下文，安排 Agent 继续执行。

跨团队的独立 Agent 服务还可以采用 [[a2a|A2A 协议]]，统一能力发现、消息、任务状态和结果的交互约定，由 HTTP 等方式承载。
