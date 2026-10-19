---
title: "Go 官方源码导读：GMP 与任务调度"
aliases: ["GMP 调度源码"]
category: "Go"
tags: ["Go", "调度", "GMP"]
learning_status: pending
created_at: "2026-10-19T17:31:03+08:00"
updated_at: "2026-10-19T17:31:03+08:00"
source:
  - "https://go.dev/src/runtime/HACKING.md"
  - "https://go.dev/src/runtime/proc.go"
  - "https://pkg.go.dev/runtime#GOMAXPROCS"
---

Go 调度器把可运行的 goroutine、操作系统线程和执行资源配合起来，通过本地队列、全局队列及工作窃取分配任务。本导读节选官方资料中与 GMP 面试回答直接相关的机制，依据 2026-10-19 查阅的在线版本，未固定发布版本，未运行调度实验。

## G、M、P 怎样配合

[运行时开发说明的 Gs, Ms, Ps](https://go.dev/src/runtime/HACKING.md)把 G 定义为 goroutine，M 定义为操作系统线程，P 定义为执行用户 Go 代码所需的资源，包含调度与内存分配器状态。调度器负责把三者匹配起来：G 提供待执行的代码，M 执行代码，P 提供所需资源。

M 执行用户 Go 代码时需要持有 P；执行系统调用时可以没有 P。P 可供不同 M 使用，调度状态因此不必与某个线程永久绑定。开发说明也指出，P 适合保存为效率而分片、又无须按线程或 goroutine 保存的状态。

P 的数量等于当前 `GOMAXPROCS`。[runtime.GOMAXPROCS](https://pkg.go.dev/runtime#GOMAXPROCS)限制 Go 代码的 CPU 并行执行规模；它不限制 goroutine 总数，也不限制进程线程总数。存在阻塞于系统调用的线程时，M 的数量可以超过 P。

## 本地队列、全局队列与窃取

[proc.go 的 findRunnable](https://go.dev/src/runtime/proc.go)组合检查本地队列、全局队列、网络事件及其他 P 的工作。常见路径先取本地工作，本地没有任务时再检查全局队列，之后还可能从网络轮询取得就绪 G，或通过 `stealWork` 从其他 P 寻找工作。

全局队列还会被定期检查，以免本地持续产生任务时，全局任务长期得不到执行。因此，“本地队列空了才看全局队列”只能作为流程简化，不能作为严格规则。

按 P 分散队列减少了集中访问共享队列的需要；窃取让空闲执行资源有机会处理其他 P 积压的工作。这是结合队列分布与寻找工作路径的归纳，不代表消除了全部共享竞争。

## 等待 G 与阻塞 M 怎样区别

[HACKING 的调度交互说明](https://go.dev/src/runtime/HACKING.md)指出，`gopark` 把 G 置为等待状态，并让当前 M/P 调度其他 G；`goready` 则把等待的 G 重新变为可运行状态。挂起 G 不要求同时阻塞 M。

真正进入阻塞系统调用时，M 可能无法继续执行其他 G。[proc.go 的 entersyscallblock 与 retake](https://go.dev/src/runtime/proc.go)展示了主动交接或由监控回收 P 的路径，让其他 M 有机会使用 P；系统调用返回后，M 需要取得 P 才能继续执行用户 Go 代码。不能把这概括为每次阻塞都立即创建新线程。

长时间运行的 G 还涉及[[go-preemption-sources|协作式与异步抢占]]，本导读不展开抢占实现。
