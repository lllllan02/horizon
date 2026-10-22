---
title: "什么是熔断，如何触发和恢复？"
category: "服务治理"
parent: performance-interview-index
tags: ["面试", "熔断", "过载保护"]
learning_status: organized
created_at: "2026-10-22 12:12:22"
updated_at: "2026-10-22 12:26:09"
learning_status_changed_at: "2026-10-22 12:27:00.459"
---

[[service-circuit-breaker|熔断（Circuit Breaker）]]是**在下游或依赖服务持续失败、超时或变慢时，暂时停止向它发起调用**的保护机制。这样可以避免大量无效请求一直占用连接、线程等资源，把调用方也拖垮，同时减轻故障依赖的压力，避免故障继续向上游扩散。

以 [[resilience4j-circuit-breaker-summary#状态如何切换|Resilience4j 的三种常规状态]]为例，整个流程是：

1. **正常调用并统计（关闭，Closed）**：正常放行请求，统计近期的失败率和慢调用比例。满足最小样本量后，相关指标达到预设阈值，就触发熔断，进入打开状态。
2. **停止调用并等待（打开，Open）**：快速拒绝对该依赖的新调用，不再继续向它发请求；业务上可以明确返回失败，或者走[[service-degradation-interview|降级]]。等待一段时间后，再进入半开状态尝试恢复。
3. **少量探测并判断恢复（半开，Half-open）**：只放行有限数量的请求，观察它们的失败率和慢调用比例。符合恢复条件，就关闭熔断器，恢复正常调用；如果仍不符合条件，就重新打开，继续等待后再探测。

**等待结束只表示可以探测，不代表依赖已经恢复。** 半开负责验证恢复情况；如果业务还需要逐步放量，可以配合[[rate-limiting-interview|限流]]控制恢复速度。
