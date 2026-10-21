---
title: "IO 多路复用有哪些实现？"
aliases: ["select、poll、epoll"]
category: "操作系统"
parent: interview-hub
tags: ["面试"]
learning_status: organized
created_at: "2026-10-20T18:36:37+08:00"
updated_at: "2026-10-20T19:46:45+08:00"
learning_status_changed_at: "2026-10-20T19:55:45.279+08:00"
---

[[io-multiplexing|IO 多路复用]]让一个线程统一等待多个连接的读写事件，再处理就绪的连接。

服务端要同时维护很多连接，而数据到达时间不同。逐个阻塞等待会耽误其他就绪连接，为每个连接安排线程又需要维护大量线程；IO 多路复用把等待集中起来，让一个线程可以轮流处理多个连接。Linux 下常见的实现有「**select、poll、epoll**」。

- [[select|select]]：用位图保存监听集合，每次传入，返回后检查哪些描述符就绪。
- [[poll|poll]]：用数组代替固定大小位图，每次仍要传入并遍历数组。
- [[epoll|epoll]]：在内核保留监听集合，等待时获取就绪项，适合大量连接中只有少量活跃的场景；支持[[epoll-trigger-interview|水平触发和边缘触发]]。
