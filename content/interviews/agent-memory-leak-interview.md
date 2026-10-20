---
title: "Agent 服务最常见的生产环境内存泄漏有哪几种？如何排查和修复？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "性能排查", "内存滞留"]
learning_status: pending
created_at: "2026-10-18T23:06:28+08:00"
updated_at: "2026-10-18T23:09:04+08:00"
---

我会从 Agent 的特点来看。它需要多轮调用模型，历史消息、[[agent-context|上下文]]和工具结果可能比较多。如果一直放在 map、数组或缓存里，没有上限和清理机制，内存就会不断增长。不再需要的数据仍被引用，属于逻辑上的[[memory-leak|内存泄漏]]；仍然需要但数量太多，则是容量问题。

模型调用的等待时间也比较长，下游变慢时容易积压大量请求和上下文，需要用[[concurrency-control|并发上限]]和[[service-backpressure|背压]]控制，这不一定是泄漏。

另外，Agent 经常有流式返回和异步任务。用户断连或请求[[timeout-and-deadline|超时]]后，如果任务没有退出、响应流和连接没有关闭，就可能继续占用资源和内存。需要传递[[agent-cancellation-interview|取消信号]]，确认任务退出，并及时关闭资源。

排查时，我会结合内存、goroutine、连接数和队列长度的变化，用 heap 和 goroutine profile 定位。修复后重点验证断连、超时和失败场景，确认数据、任务和资源能正常清理。
