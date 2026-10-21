---
title: "如何手写一个 Go 协程池？"
aliases: ["Goroutine Pool", "Worker Pool", "手写协程池"]
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go", "并发"]
learning_status: organized
created_at: "2026-10-20 18:29:13"
updated_at: "2026-10-20 18:36:26"
learning_status_changed_at: "2026-10-20 19:19:40.376"
---

协程池是让一组 [[coroutine#Go 的 goroutine|goroutine]] 持续接收并执行任务，避免为每个任务都新建协程。我会用「**固定数量的工作协程＋有界任务队列**」实现，在复用协程的同时，[[concurrency-control|限制任务并发]]和排队数量，避免任务不断堆积。

整体结构是提交方通过 `Submit` 把 `func()` 放入有缓冲的 [[go-channel-interview|Channel]]，多个工作协程共同消费。每个工作协程直接执行取出的任务，完成后再取下一项，所以 N 个工作协程最多同时执行 N 个任务。队列用于暂存来不及处理的任务，这个版本选择在队列满时返回错误，由调用方决定如何处理。

生命周期上，用互斥锁协调提交与关闭，避免向已关闭的 Channel 发送。[[go-channel-close-interview|关闭队列]]后，工作协程仍会处理完已接收的任务，再由 `WaitGroup` 等待它们全部退出。每个任务单独包装 `recover`，记录普通 panic 后继续处理后续任务；提交成功只表示任务已接收，不代表执行成功。

## 主体代码

[[assets/goroutine-pool-demo.go|Go 主体代码与调用示例]]
