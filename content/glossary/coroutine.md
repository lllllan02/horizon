---
title: "协程"
aliases: ["Coroutine", "Coroutines"]
category: "计算机基础"
tags: ["并发", "调度"]
learning_status: pending
created_at: "2026-10-20T19:23:41+08:00"
updated_at: "2026-10-20T19:23:41+08:00"
---

**协程（Coroutine）是可以挂起、之后恢复执行的程序执行单元，通常由程序或语言运行时在用户态调度。** [[process-thread-sources#协程的挂起与恢复|挂起时保留继续执行所需的状态]]，让多个任务能够复用[[thread|线程]]，减少为每个任务创建操作系统线程的需要。

协程仍需依托线程执行，共享所在[[process|进程]]的地址空间，不提供进程级的资源隔离。是否能跨线程调度、是否支持抢占以及能否多核并行，取决于具体实现。

## Go 的 goroutine

[[process-thread-sources#Go 的 goroutine|goroutine]]是 Go 运行时管理的轻量并发执行单元，通常也被称为 Go 协程。运行时把多个 goroutine 复用到多个操作系统线程上，使用可自动增缩的小栈，并支持抢占和多核并行；不能将所有协程都理解为只在单线程上主动让出执行权。
