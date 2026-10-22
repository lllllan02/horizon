---
title: "分布式缓存是什么？"
aliases: ["Distributed Cache"]
category: "Redis"
parent: redis-interview-index
tags: ["面试", "Redis", "缓存"]
learning_status: organized
created_at: "2026-10-22 11:26:34"
updated_at: "2026-10-22 11:37:25"
learning_status_changed_at: "2026-10-22 11:41:31.843"
---

在应用架构中，[[distributed-cache-sources|分布式缓存（Distributed Cache）]]是**供多个服务或应用实例通过网络共享使用的缓存服务**，用来复用缓存数据，减少数据库访问。

比如多个应用实例共同访问一套 Redis，就可以共享其中的缓存；本地缓存则保存在各个实例自己的进程内存里，通常只能由自己使用。Redis 是实现分布式缓存的常见选择。
