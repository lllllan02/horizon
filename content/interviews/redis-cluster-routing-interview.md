---
title: "Redis Cluster 如何路由请求，MOVED 和 ASK 有什么区别？"
category: "Redis"
parent: redis-interview-index
tags: ["面试", "Redis"]
learning_status: organized
created_at: "2026-10-19 20:27:42"
updated_at: "2026-10-19 20:27:42"
learning_status_changed_at: "2026-10-19 20:35:24.694"
---

支持 [[redis-cluster-interview|Redis Cluster]] 的客户端连接集群后，会查询并缓存**「哈希槽和节点的映射」**。读写一个 key 时，先算出它属于哪个槽，再按照映射访问对应节点。

如果槽的归属发生了变化，请求发错了节点，服务端会返回 `MOVED`，告诉客户端正确的节点地址。客户端会向目标节点重新发送请求，并更新对应映射，或者刷新整个集群拓扑。

如果正在迁移槽位，也可能返回 `ASK`，让客户端把这一次请求临时发到另一个节点，但不直接修改这个槽的长期映射。
