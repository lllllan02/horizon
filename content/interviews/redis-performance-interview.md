---
title: "Redis 为什么快？"
category: "Redis"
parent: redis-interview-index
tags: ["面试", "Redis", "性能"]
learning_status: organized
created_at: "2026-10-19 22:24:24"
updated_at: "2026-10-19 22:27:03"
learning_status_changed_at: "2026-10-19 22:28:35.831"
---

Redis [[redis-performance-sources|速度快]]，主要有四个原因：

1. **「内存存储」**：常规读写直接操作内存，减少了访问磁盘的开销。
2. **「高效的数据结构」**：根据操作选择合适的数据结构，让常用操作的时间复杂度较低，比如按 key 读取字符串的 `GET` 是 `O(1)`。
3. **「非阻塞 I/O」**与[[io-multiplexing|I/O 多路复用]]：通过[[redis-events-interview|事件循环]]监听多个连接，处理已经就绪的连接，避免为每个连接创建一个[[thread|线程]]、阻塞等待。
4. **「单线程执行命令」**：常规命令主要由主线程串行执行，减少并发访问数据时的锁竞争和线程切换开销。

这里的单线程主要指命令执行，整个 Redis [[process|进程]]还会使用后台线程。单线程适合大量短小的内存操作，慢命令仍可能阻塞后续请求。
