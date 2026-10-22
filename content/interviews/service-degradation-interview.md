---
title: "降级是做什么的，大概怎么做？"
category: "服务治理"
parent: performance-interview-index
tags: ["面试", "服务治理", "过载保护"]
learning_status: organized
created_at: "2026-10-19 16:40:22"
updated_at: "2026-10-22 12:30:07"
learning_status_changed_at: "2026-10-22 12:30:28.249"
---

降级（Graceful Degradation）是**在流量过大、资源不足或下游故障时，减少非核心功能，或者降低结果质量、实时性等要求，优先保障核心业务可用**的应对方式。比如暂停推荐功能、使用更简单的搜索逻辑，或返回允许短暂过期的缓存结果，通过[[service-resilience-sources#降级减少完成请求所需的工作|减少计算和依赖调用]]，把资源留给核心链路；订单金额、权限校验等核心正确性仍要保证。

降级可以作为[[rate-limiting-interview|限流]]或[[service-circuit-breaker-interview|熔断]]后的业务处理方案，也可以在自身资源紧张时主动启用。恢复时，要确认实际负载和依赖状态已经稳定，再逐步恢复功能；限流放宽或熔断解除可以作为参考，但不自动代表完整业务已经能够恢复。
