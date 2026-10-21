---
title: "Agent 的 Trace 怎么做，线上问题怎么定位？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "Trace", "可观测性"]
type: practice
learning_status: organized
created_at: "2026-10-21 17:14:51"
updated_at: "2026-10-21 17:20:55"
learning_status_changed_at: "2026-10-21 17:25:40.311"
---

我会用 [[trace-and-span|Trace]] 把一次完整的 Agent 运行串起来。Loop 里的每次模型调用、工具调用，以及子 Agent 调用，都分别记录为 Span，用同一个 Trace ID 和父子关系关联起来；跨服务或异步执行时，也要[[otel-trace-collection#调用关系怎样传到另一个执行单元？|传递追踪上下文]]，避免链路断开。

每一步保留必要的起止时间、状态、错误和输入输出，同时记录使用的模型、提示词和代码版本，方便还原当时的执行条件。输入输出按需脱敏，每次重试也单独记录，不能让最终成功覆盖前面的失败。

线上排错时，先根据日志或用户反馈拿到 Request ID、任务 ID 或 Trace ID，再定位整条链路。这些 ID 要提前建立关联，日志也带上 Trace ID 和 Span ID。然后看具体哪一步耗时长、哪一步报错，再结合它的输入输出和上下游日志分析原因；父层报错可能只是子调用失败的结果，还要继续往下查。

如果调用都成功但答案不对，就沿[[agent-trace#在 Langfuse 排障并回归|实际输入输出]]找第一次偏离预期的位置。**技术调用成功不代表任务做对了。**
