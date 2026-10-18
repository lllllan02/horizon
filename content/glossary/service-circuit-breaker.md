---
title: "熔断"
aliases: ["Circuit Breaker", "Circuit Breaking"]
category: "服务治理"
tags: ["熔断", "服务治理"]
learning_status: pending
created_at: "2026-10-18T23:47:18+08:00"
updated_at: "2026-10-18T23:47:18+08:00"
---

**熔断（Circuit Breaker）是在依赖持续失败或变慢时，暂时停止向它发起调用的保护机制。** 它根据近期调用结果判断是否继续放行，避免大量无效等待继续消耗调用方资源，也减轻故障依赖承受的压力。

常见熔断器有[[resilience4j-circuit-breaker-summary#状态如何切换|三种状态]]：

- **关闭（Closed）**：正常放行并记录结果；样本量足够且失败率或慢调用比例达到阈值时，转为打开。
- **打开（Open）**：快速拒绝新调用；等待一段时间后，允许进入半开探测。
- **半开（Half-open）**：只放行少量探测调用；结果符合恢复条件时关闭，否则重新打开。

[[timeout-and-deadline|超时]]限制一次调用等多久，熔断决定近期还要不要继续调用该依赖；统计窗口大小也不等于[[concurrency-control|并发上限]]。熔断后的拒绝可以由业务接成降级结果，但熔断器本身不保证有可用替代服务，也不保证依赖已经恢复。
