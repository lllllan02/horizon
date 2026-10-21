---
title: "进程、线程、协程的区别是什么？"
aliases: ["进程线程协程对比", "Process、Thread 与 Goroutine"]
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go", "并发"]
learning_status: organized
created_at: "2026-10-20 18:36:05"
updated_at: "2026-10-20 19:26:26"
learning_status_changed_at: "2026-10-20 19:32:58.262"
---

- [[process|进程（Process）]]是「**程序的一次运行实例**」，也是资源分配和隔离的基本单位，有独立的虚拟地址空间，创建和切换开销通常较大。
- [[thread|线程（Thread）]]是「**进程内的一条执行流**」，由操作系统调度，有自己的栈和寄存器上下文，比进程更轻量。
- [[coroutine|协程（Coroutine）]]是「**可挂起、恢复的轻量执行任务**」，由程序或语言运行时在用户态调度。Go 中通常把 goroutine 称为协程，初始栈小且能按需增长，创建和调度开销通常比线程低。

一个进程可以包含多个线程，线程共享进程的地址空间和资源；Go 运行时通过 [[go-gmp-interview|GMP 模型]]，把多个 goroutine 调度到多个线程上执行，两者是「**多对多关系**」，通常不固定绑定。线程和 goroutine 并发访问共享数据且存在写入时，都需要同步；goroutine 可以多核并行，实际并行度受 `GOMAXPROCS` 等条件限制。
