---
title: "Redis 的事件"
category: "Redis"
parent: redis-interview-index
tags: ["面试", "Redis"]
learning_status: organized
created_at: "2026-10-19T10:45:49+08:00"
updated_at: "2026-10-19T10:45:49+08:00"
learning_status_changed_at: "2026-10-19T10:46:57.292+08:00"
---

Redis 是一个**「事件驱动的服务」**，它的事件主要分为文件事件和时间事件。

- **「文件事件」**主要用于处理网络通信，比如有新的客户端连接，或者有新的请求进来。相关事件就绪后，Redis 就会调用对应的处理函数。
- **「时间事件」**用于处理定时任务，比如周期性地[[redis-expiration-sources|清理过期 key]]。

Redis 通过**「事件循环」**统一调度、处理这两类事件。
