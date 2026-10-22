---
title: "缓存穿透是什么，怎么解决？"
aliases: ["缓存穿透"]
category: "Redis"
parent: redis-interview-index
tags: ["面试", "缓存", "过载保护"]
learning_status: organized
created_at: "2026-10-22 11:24:44"
updated_at: "2026-10-22 11:33:53"
learning_status_changed_at: "2026-10-22 11:40:02.048"
---

**缓存穿透是请求查询数据库中不存在的数据，缓存也无法命中，导致请求反复落到数据库的现象。**

主要有两种做法：

1. **「缓存空值」**：数据库确认不存在时，将[[cache-avalanche-sources#负缓存减少无效回源|空结果也缓存起来]]，并设置较短的 TTL，避免相同请求反复查库。
2. **「布隆过滤器」**：不断请求不同的无效 ID 时，缓存空值的作用有限。可以将已有数据的 ID 录入并持续维护在[[bloom-filter-interview|布隆过滤器（Bloom Filter）]]中，拦截判定不存在的请求；判定「可能存在」时，再继续查缓存或数据库。
