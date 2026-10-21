---
title: "Redis 面试题"
category: "Redis"
parent: interview-hub
tags: ["面试", "Redis"]
type: overview
learning_status: organized
created_at: "2026-10-19T10:51:27+08:00"
updated_at: "2026-10-19T21:05:27+08:00"
learning_status_changed_at: "2026-10-21T10:12:32.067+08:00"
---

围绕 Redis 的运行机制、集群与缓存使用整理已保存的面试题。

## 运行机制

- [[redis-events-interview|Redis 的事件]]
- [[redis-performance-interview|Redis 为什么快？]]
- [[redis-expiration-interview|Redis 的过期机制是怎么实现的？]]

## 部署模式与请求路由

- [[redis-modes-interview|Redis 的集群、主从和哨兵分别解决什么问题？]]
- [[redis-cluster-interview|介绍一下 Redis 的集群模式？]]
- [[redis-cluster-routing-interview|Redis Cluster 如何路由请求，MOVED 和 ASK 有什么区别？]]

## 故障切换

- [[redis-sentinel-failover-interview|Redis 主从加哨兵模式下，主从切换的流程是怎么样的？]]
- [[redis-replica-promotion-interview|Redis 哨兵如何选择要提升为主节点的从节点？]]
- [[redis-cluster-failover-interview|Redis Cluster 模式下，主从切换的流程是怎么样的？]]

## 缓存一致性与过载保护

- [[cache-consistency-interview|数据库和缓存的一致性怎么保障？]]
- [[cache-optimization-interview|高并发下，如何优化缓存和数据库访问？]]
- [[cache-avalanche-interview|缓存雪崩怎么解决？]]
