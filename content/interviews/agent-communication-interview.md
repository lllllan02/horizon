---
title: "父子 Agent 和多 Agent 之间怎么通信？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "多Agent协作"]
learning_status: organized
created_at: "2026-10-19 12:28:23"
updated_at: "2026-10-19 12:28:23"
learning_status_changed_at: "2026-10-19 12:31:25.297"
---

[[multi-agent|多 Agent 协作]]中，父子 Agent 也是一种协作关系。通信方式可以从**「任务委派」**和**「执行过程中的协调」**两个角度来讲。

1. **「[[parent-agent-interview|父子 Agent 的任务委派]]」**：父 Agent 可以把子 Agent 包装成一个可调用的[[tool-calling|工具]]，传入任务要求、必要上下文和参数，由子 Agent 独立执行，最终返回结果。如果任务边界明确，通常只需要下发任务和返回结果，不需要持续交换中间消息。实现上可以直接调用子 Agent 的执行函数，或者通过异步任务、Future 获取结果；需要补充信息时，父子之间也可以继续通信。

2. **「多个 Agent 在执行过程中协调」**：比如交换中间结果、请求补充信息，或者等待其他 Agent 完成某个阶段。同一[[process|进程]]内，可以给每个 Agent 建立内存队列或 Channel，维护 `agentID → Channel` 的映射，发送方找到目标 Channel 写入消息，接收方的执行循环读取。跨进程、跨服务时，可以用 Redis、消息队列，或者 HTTP、gRPC。例如用 Redis List 为每个 Agent 建队列，发送方写入，接收方阻塞读取；通过 HTTP 调用长任务时，可以先返回任务 ID，再通过轮询、流式更新或回调获取状态和结果。

跨框架、跨团队的 Agent 还可以采用 [[a2a|A2A 协议]]，统一能力发现、消息、任务状态和产物的交互约定。**「A2A 规定交互语义，HTTP 等负责承载请求」**，这两个层次可以组合使用。

消息一般包含发送方、接收方、任务 ID、消息类型和内容，也可以携带共享文件中的产物地址。接收方的程序读到消息后，更新任务状态，或者将消息加入上下文，再安排模型继续执行；等待其他 Agent 时，可以保存进度并等待事件，收到依赖结果后继续。
