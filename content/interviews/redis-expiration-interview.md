---
title: "Redis 的过期机制是怎么实现的？"
aliases: ["Redis EXPIRE 原理"]
category: "Redis"
parent: redis-interview-index
tags: ["面试", "Redis", "过期机制"]
learning_status: organized
created_at: "2026-10-19T10:35:33+08:00"
updated_at: "2026-10-19T10:40:20+08:00"
learning_status_changed_at: "2026-10-19T10:43:32.599+08:00"
---

Redis 的[[redis-expiration-sources|过期机制]]既可以设置一个具体的到期时间，也可以设置一个过期时长，但**「底层最终记录的都是一个具体的到期时间」**。

记录到期时间后，Redis 主要通过两种方式清理过期 key：

1. 访问时检查，也叫**「惰性删除」**：当我们通过 `GET` 获取 key 时，会检查是否已经过期。如果过期，就清理掉，返回不存在。
2. 定期随机小批量清理，也叫**「主动过期」**：定期从设置了过期时间的 key 中随机抽查一小批，删除其中已经过期的 key。

在这样的设计下，如果有大量 key 已经过期，却没有再被访问，就主要依靠主动清理。清理可能暂时跟不上，导致 Redis 中**「积压大量已过期的 key，继续占用内存」**。
