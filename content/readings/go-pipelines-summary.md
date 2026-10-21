---
title: "Go 官方并发文章：协程退出与有界并发"
category: "Go"
tags: ["Go", "并发"]
learning_status: pending
created_at: "2026-10-20 19:44:29"
updated_at: "2026-10-20 19:44:29"
source: "https://go.dev/blog/pipelines"
---

Go 官方文章 *Go Concurrency Patterns: Pipelines and cancellation* 通过 Channel 流水线说明：并发任务需要退出路径，也需要限制资源占用。本导读节选协程泄漏与有界并发两部分；原文发表于 2014 年，示例 API 沿用当时写法，未运行示例。

## 协程需要自行退出

[Stopping short](https://go.dev/blog/pipelines#stopping-short) 展示了下游提前停止接收的情况：上游仍尝试发送，协程就可能一直阻塞。它仍占用内存与运行时资源，栈中的堆引用也会阻止相关对象被回收；GC 不会自动清理这个协程，需要让它自行退出。

增加 Channel 缓冲只能容纳有限的未读结果，结果更多时仍可能阻塞。文章用独立的 `done` Channel 传播取消信号，让发送方通过 `select` 在取消后退出。

## 限制同时处理的任务数

[Bounded parallelism](https://go.dev/blog/pipelines#bounded-parallelism) 中，每个文件启动一个协程、读入文件并计算摘要。大量大文件并行读取时，合计分配可能超过机器内存。

文章改用固定数量的工作协程消费文件路径，限制同时读取的文件数，从而限制这部分并发分配。示例中的 worker 数量只是演示，不能当作其他服务的容量标准。
