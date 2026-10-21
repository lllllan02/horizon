---
title: "聊一聊 Go 的 GMP 调度模型"
aliases: ["GMP", "Go 调度模型", "Goroutine 调度"]
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go", "调度", "GMP"]
learning_status: organized
created_at: "2026-10-19T17:31:03+08:00"
updated_at: "2026-10-19T17:31:03+08:00"
learning_status_changed_at: "2026-10-19T21:49:19.755+08:00"
---

[[go-gmp-sources|GMP]] 是 Go 运行时的调度模型，用来把大量 [[coroutine#Go 的 goroutine|goroutine]] 调度到[[thread|操作系统线程]]上执行，复用线程，并利用多核并行处理任务。

- **G 是 goroutine**，保存协程的栈、执行位置和状态。
- **M 是操作系统线程**，负责实际执行代码。
- **P 是执行 Go 代码所需的调度资源**，维护本地可运行 G 队列等状态。M 要持有一个 P，才能执行普通 Go 代码。

运行时通常从当前 P 的本地队列取出 G，交给 M 执行。本地没有任务时，会尝试从全局队列获取，或从其他 P 的本地队列窃取任务；网络事件就绪也能提供可运行的 G。本地队列减少共享竞争，工作窃取用来平衡忙闲。为了公平，调度器还会定期检查全局队列。

如果 G 因为等待 Channel 等原因挂起，M 可以继续执行其他 G。如果是阻塞系统调用把 M 阻塞了，运行时可以交接或回收 P，让其他 M 接着执行任务。M 和 P 的关系可以变化，P 不必一直跟着某个线程等待。对于长时间占用执行机会的 G，还有[[go-preemption-interview|抢占机制]]。

**P 的数量由 `GOMAXPROCS` 决定**，限制的是同时执行普通 Go 代码的并行规模；goroutine 数量和进程线程总数都可以超过它。并发任务多，也不代表它们都在同一时刻执行。
