---
title: "缓存雪崩怎么解决？"
aliases: ["缓存雪崩", "Cache Avalanche"]
category: "Redis"
parent: redis-interview-index
tags: ["面试", "缓存", "过载保护"]
learning_status: organized
created_at: "2026-10-19T17:18:29+08:00"
updated_at: "2026-10-19T17:21:53+08:00"
learning_status_changed_at: "2026-10-19T17:22:24.330+08:00"
---

**缓存雪崩是大量缓存集中失效，导致大量并发请求回源，数据库等后端承受突发压力的现象。**

针对集中过期，可以在设置 TTL（有效时长）时，[[cache-avalanche-sources#打散过期时间|给每个 key 分别引入随机量]]，把过期时间分散开，**「降低集中过期的风险」**。

但如果是**「缓存服务直接故障」**，随机过期就解决不了。此时仍可能有大量请求回源，需要结合[[rate-limiting|限流]]和[[service-degradation-interview|降级]]，按下游服务或数据库能承受的能力限制回源请求，保护它们不被突发流量压垮。
