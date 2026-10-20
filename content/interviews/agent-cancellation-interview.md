---
title: "Agent 怎样响应用户取消并处理迟到结果？"
aliases: ["Agent 取消传播与迟到结果处理"]
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "取消"]
type: practice
learning_status: organized
created_at: "2026-10-20T14:47:16+08:00"
updated_at: "2026-10-20T15:12:09+08:00"
learning_status_changed_at: "2026-10-20T15:13:07.668+08:00"
---

我会分两层处理：**先通知正在执行的任务退出，再拦住迟到结果，避免取消后继续推进任务。**

## 通知任务退出

首先，为每次 Agent 运行保存可查询的取消状态，比如用 Redis key。Agent Loop 在模型或工具调用前后检查，发现取消就不再启动后续工作。Channel 或发布订阅可以加快通知，但 [[agent-cancellation-sources#Redis 通知可能丢失|Redis Pub/Sub 可能丢消息]]，仍要能回查状态。

如果正在等待长任务，就要把取消传给执行中的调用，避免一直等到下一轮检查：

- **Go**：调用 `cancel()`，goroutine 通过 [[go-context-interview|ctx.Done()]] 响应取消，支持 Context 的下游请求也传入同一个 Context。
- **Node**：给支持取消的请求传入 `AbortSignal`。
- **子进程**：发送终止信号，等待退出，并清理[[sandbox-processes|任务所属的残留进程]]。

## 拦住迟到结果

有些调用无法及时取消，**用户取消或任务超时后，就先让本次运行失效，无须等待调用返回。** 如果结果写数据库，取消也要更新库内运行状态，不能只改 Redis 标记。

调用以后即使返回，也要在同一原子操作或事务中，检查「**运行仍有效、状态允许提交、执行版本匹配**」后再[[agent-cancellation-sources#用条件提交处理取消与写回竞争|提交结果]]。重新执行时更新版本，防止旧调用覆盖新结果。先查询状态、再无条件写入会留下竞态。

条件不匹配时，拒绝将结果提交为当前运行的成功结果，也不触发后续动作。**这样即使调用暂时停不下来，也不能让已经取消的任务继续推进。**
