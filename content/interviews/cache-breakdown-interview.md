---
title: "缓存击穿是什么，怎么解决？"
aliases: ["缓存击穿"]
category: "Redis"
parent: redis-interview-index
tags: ["面试", "缓存", "过载保护"]
learning_status: organized
created_at: "2026-10-22 11:24:44"
updated_at: "2026-10-22 11:32:18"
learning_status_changed_at: "2026-10-22 11:33:13.719"
---

**缓存击穿是热点 key 的缓存过期或缺失时，大量并发请求同时查询数据库，造成突发压力的现象。**

可以从三个方向处理：

1. **「延长有效期」**：对更新较少的热点数据，适当设置较长的 TTL，必要时不过期，同时配合主动更新或失效策略，维护[[cache-consistency-interview|缓存一致性]]。
2. **「合并回源请求」**：比如用 Go 的 [[go-singleflight-interview|Singleflight]]，将同一进程内、同 key 的重叠请求合并成一次数据库查询，其余共享结果。
3. **「提前刷新」**：通过定时任务，或在查询时发现缓存即将过期，启动后台任务或协程[[cache-avalanche-sources#缓存故障为何需要回源保护|提前回源并刷新缓存]]。
