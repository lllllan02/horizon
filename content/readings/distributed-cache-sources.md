---
title: "分布式缓存与 Redis 部署方式资料导读"
category: "Redis"
type: article
tags: ["Redis", "缓存"]
learning_status: pending
created_at: "2026-10-22 11:26:34"
updated_at: "2026-10-22 11:26:34"
source:
  - "https://learn.microsoft.com/en-us/aspnet/core/performance/caching/distributed?view=aspnetcore-10.0"
  - "https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/"
  - "https://redis.io/docs/latest/operate/oss_and_stack/management/replication/"
  - "https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/"
---

**多个应用共享缓存，与缓存服务内部怎样部署，是两个需要分别说明的问题。** Microsoft 的应用开发文档侧重共享的外部缓存；Redis 文档进一步说明多节点如何分片、复制及故障切换。本篇节选这些概念，不覆盖部署配置与容量规划。

## 应用为什么需要共享缓存

Microsoft [Distributed caching in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/performance/caching/distributed?view=aspnetcore-10.0) 开篇把分布式缓存定义为多个应用服务器共享的缓存，通常作为应用之外的服务维护。相对于每个应用服务器各自保存缓存，这种方式让不同实例访问同一份缓存，缓存生命周期也不必跟随应用进程重启。原文列出的实现包括 Redis、SQL Server 和 Postgres，说明这种用法首先描述应用与缓存的关系。

据此可以区分：多个应用连接单实例 Redis，已经实现了共享外部缓存，但 Redis 的数据存储仍是单节点。称它为分布式应用使用的共享缓存，不代表它已经具备多节点容量或故障接替能力。这里是对文档定义与部署结构的归纳，不能由共享缓存进一步推出它与业务数据库之间的强一致性。

## 分片与副本分别改变什么

Redis [Cluster 介绍与分片说明](https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/#redis-cluster-101)说明，Cluster 把数据自动分到多个 Redis 节点；每个主节点负责一部分哈希槽。不同 key 可以由不同节点承载，因此多节点共同承担数据集和请求。

同页的 [主从模型](https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/#redis-cluster-master-replica-model)说明，副本保存对应主节点的数据，主节点失效时可由副本接替。分片负责拆分数据，复制负责保存同一分片的多份数据，两者可以组合；副本增加并不等于独立数据容量同比增加，故障切换也有成立条件。

Redis [Replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/)还说明，副本可以提供只读查询来分担读压力；默认复制是异步的，因此副本可能暂时落后于主节点。

## 哨兵负责故障切换

Redis [Sentinel 文档](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/)将 Sentinel 用于非 Cluster Redis 的高可用，提供监控、通知、自动故障切换与服务发现。它协调主从切换，不负责将不同 key 分到多个主节点。Cluster 自身已有对应的故障转移机制。

综合这些机制，判断一套缓存架构时，应分别看应用是否共享缓存、数据是否分片、是否存在副本及谁负责切换；仅凭实例或集群数量无法判断这些关系。资料于 2026-10-22 核对官方在线文档，未执行部署或故障实验。
