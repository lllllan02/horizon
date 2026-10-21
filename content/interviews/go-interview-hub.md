---
title: "Go 面试题"
category: "Go"
parent: interview-hub
tags: ["面试", "Go"]
type: overview
learning_status: organized
created_at: "2026-10-19 16:21:41"
updated_at: "2026-10-19 16:21:41"
learning_status_changed_at: "2026-10-21 10:01:26.593"
---

围绕 Go 的并发协作、协程调度、内存管理与排障，整理已保存的面试题和口述回答。

## Channel 与取消协作

- [[go-channel-interview|Go 的 Channel 一般怎么用？]]
- [[go-channel-structure-interview|Go 的 chan 底层数据结构是什么？]]
- [[go-channel-close-interview|怎么防止 Go Channel 重复关闭？]]
- [[go-context-interview|Go 的 Context 是什么？怎么使用？]]
- [[go-context-cancel-interview|Go 的 WithCancel 和 WithoutCancel 有什么区别？]]

## 锁与请求合并

- [[go-mutex-interview|聊一聊 Go 的互斥锁和读写锁]]
- [[go-singleflight-interview|Go 的 Singleflight 是怎么实现的？]]

## 并发与调度

- [[go-goroutine-overhead-interview|为什么 Go 的协程开销小？]]
- [[go-process-thread-interview|进程、线程、协程的区别是什么？]]
- [[go-goroutine-limit-interview|为什么不能无限制地开 Go 协程？会有什么后果？]]
- [[go-pool-interview|如何手写一个 Go 协程池？]]
- [[go-gmp-interview|聊一聊 Go 的 GMP 调度模型]]
- [[go-preemption-interview|Go 协程是怎么抢占的？]]

## 内存管理与排障

- [[go-escape-interview|Go 中哪些堆分配值得优化？怎么优化？]]
- [[go-memory-leak-interview|Go 语言中内存泄漏的常见原因是什么？]]
- [[go-memory-leak-diagnosis-interview|Go 程序出现内存泄漏，怎么排查？]]
- [[go-oom-interview|Go 程序什么情况下会内存溢出？怎么排查？]]
