---
title: "介绍一下 Redis 的集群模式？"
aliases: ["Redis Cluster"]
category: "Redis"
parent: redis-interview-index
tags: ["面试", "Redis"]
learning_status: organized
created_at: "2026-10-19 19:42:57"
updated_at: "2026-10-19 19:42:57"
learning_status_changed_at: "2026-10-19 19:49:10.240"
---

Redis Cluster 主要是为了解决**「单机内存容量和读写能力的瓶颈」**，同时提供一定的高可用能力。它的核心思路是把数据分片：整个集群有 **16384 个哈希槽**，每个主节点负责一部分槽位，承担这部分数据的读写请求。

当我们读写一个 key 时，客户端会[[redis-cluster-routing-interview|根据这个 key 算出它属于哪个哈希槽]]，再找到负责这个槽的主节点，到对应节点执行读写。

高可用方面，**「集群分片和主从复制可以一起使用」**。每个主节点都可以配置自己的从节点，保存数据副本。主节点宕机后，在满足[[redis-cluster-failover-interview|故障转移条件]]时，从节点可以被提升为主节点，接管原来的槽位，继续提供服务。
