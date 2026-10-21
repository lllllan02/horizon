---
title: "高并发下，如何优化缓存和数据库访问？"
aliases: ["热点 Key 优化", "高并发缓存优化"]
category: "Redis"
parent: redis-interview-index
tags: ["面试", "缓存", "过载保护"]
learning_status: organized
created_at: "2026-10-20T21:25:08+08:00"
updated_at: "2026-10-20T21:25:08+08:00"
learning_status_changed_at: "2026-10-20T21:36:01.336+08:00"
---

我会先看压力是「**集中在少数热点 key**」，还是「**整体访问量过大**」，再确认瓶颈在 Redis 还是数据库。

## 热点 Key

### 缓存失效：合并回源

如果是热点 key，缓存失效时大量请求同时查库，可以用[[go-singleflight-interview|请求合并]]，让一个请求查询并回填，其余共享结果，减少重复回源。它只合并同 key、执行期间重叠的调用，进程内的 Singleflight 也不会自动协调其他实例。

### 缓存命中：本地分流

如果缓存一直命中，但 Redis 仍有压力，可以在应用进程内增加[[redis-client-cache-sources|本地缓存]]，形成「本地 L1 → Redis L2 → 数据库」，让热点读取在本地返回。

这适合读多、更新较少的数据，但每个实例都多了一份副本，需要结合 TTL 和失效通知管理旧值，[[cache-consistency-interview|缓存一致性]]也会更复杂。

## 访问分散：优化整体容量

如果访问分散在大量不同 key，请求合并收益有限，就要看整体容量。先检查命中率、慢命令和[[mysql-slow-query-interview|慢 SQL]]；优化后仍有瓶颈，再考虑用 [[redis-cluster-interview|Redis Cluster 分片]]分担负载，数据库则按瓶颈判断是否需要[[mysql-sharding-interview|跨实例分库分表]]。

## 过载保护：限流与并发控制

无论是否拆分，都要按数据库承受能力做好[[rate-limiting|回源限流]]和[[concurrency-control|并发控制]]，超出时及时拒绝或[[service-degradation-interview|降级]]，避免请求一直堆积。扩容提高处理能力，限流和并发控制负责让负载保持在可承受范围内。
