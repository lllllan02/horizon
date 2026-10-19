---
title: "Redis 哨兵如何选择要提升为主节点的从节点？"
category: "Redis"
parent: redis-interview-index
tags: ["面试", "Redis"]
learning_status: organized
created_at: "2026-10-19T21:05:27+08:00"
updated_at: "2026-10-19T21:11:02+08:00"
learning_status_changed_at: "2026-10-19T21:12:34.317+08:00"
---

在[[redis-sentinel-failover-interview|主从切换]]时，由领头哨兵来[[redis-replica-promotion-sources|选择一个合适的从节点]]，把它提升为新主节点。

选择时，先看**节点是否可达、状态是否正常**，排除不合适的节点；再根据**配置的优先级**来选择，优先级相同时，再比较**复制进度**，选择已经同步了更多数据的节点。
