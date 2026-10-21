---
title: "IO 多路复用"
aliases: ["I/O Multiplexing", "I/O 多路复用"]
category: "操作系统"
tags: ["IO多路复用"]
learning_status: pending
created_at: "2026-10-20 19:46:45"
updated_at: "2026-10-20 19:46:45"
---

**IO 多路复用（I/O Multiplexing）**让一个[[thread|线程]]统一等待多个文件描述符的就绪事件，再处理已经就绪的对象。文件描述符是操作系统用于标识打开的连接、文件等对象的整数。

服务端往往同时维护很多连接，数据到达的时间却不同。逐个阻塞等待会耽误其他就绪连接，为每个连接安排线程又需要维护大量线程；IO 多路复用把多个连接的等待集中起来，让一个线程可以轮流处理它们。

Linux 常见实现有[[select|select]]、[[poll|poll]]和[[epoll|epoll]]。它们提供[[linux-io-sources|就绪通知]]，应用仍要执行实际读写；一次就绪不代表已经收到了完整请求。
