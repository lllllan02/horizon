---
title: "Resilience4j：熔断状态、统计与并发边界"
category: "服务治理"
tags: ["熔断", "过载保护"]
learning_status: pending
created_at: "2026-10-18T23:47:18+08:00"
updated_at: "2026-10-18T23:47:18+08:00"
source: "https://resilience4j.readme.io/docs/circuitbreaker"
---

Resilience4j 的 [CircuitBreaker 文档](https://resilience4j.readme.io/docs/circuitbreaker)通过近期失败率和慢调用比例控制是否继续访问依赖。它的统计窗口用于判断健康状态，不提供并发容量隔离。

## 状态如何切换

正常状态包括关闭、打开与半开。关闭时记录调用结果；满足最小样本量后，失败率或慢调用比例达到阈值会打开[[service-circuit-breaker|熔断器]]，拒绝新调用。等待期结束后可进入半开，具体由后续调用触发还是后台自动转换取决于配置。半开放行有限探测，依据探测结果恢复关闭或重新打开；等待期结束不证明依赖已经健康。[状态与触发条件](https://resilience4j.readme.io/docs/circuitbreaker#failure-rate-and-slow-call-rate-thresholds)

## 统计什么以及没有限制什么

滑动窗口可按最近若干次调用或最近若干秒聚合。异常可以计为失败、成功或忽略，分类会影响比例；慢调用另有耗时门槛。阈值和最小样本量要一起判断，不能只看失败百分比。

文档明确指出，关闭状态下，即使并发调用数超过窗口大小，也可能全部放行；限制并发要组合 Bulkhead 等容量控制。半开探测额度、统计窗口和正常状态的并发上限分别控制不同对象。[并发边界](https://resilience4j.readme.io/docs/circuitbreaker#failure-rate-and-slow-call-rate-thresholds)

本导读节选状态机与统计、并发边界，不覆盖完整配置 API、事件接口及特殊状态；按 2026-10-18 在线文档整理，未运行示例。
