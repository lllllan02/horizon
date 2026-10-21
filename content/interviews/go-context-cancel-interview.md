---
title: "Go 的 WithCancel 和 WithoutCancel 有什么区别？"
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go"]
learning_status: organized
created_at: "2026-10-19 15:24:52"
updated_at: "2026-10-19 15:24:52"
learning_status_changed_at: "2026-10-19 15:27:59.344"
---

`context.WithCancel` 可以理解为正常派生一个[[go-context-interview|子 Context]]，保留父级的 Value 查询、Deadline 和取消传播，**「再多一个自己的 cancel 函数」**。父级取消时，子级跟着取消；调用自己的 `cancel()` 会取消自己和下游，但不会反过来影响父级。

`context.WithoutCancel` 则是**「保留 Value 查询，切断父级的取消和超时传播」**，适合仍需读取请求元数据、但不应随原请求取消的后续工作。它不修改父 Context，也不返回 `cancel` 函数；自身的 `Done()` 是 nil，`Err()` 始终是 nil，且没有 Deadline。Value 仍沿父级查询，并没有复制成独立快照。这个函数从 Go 1.21 开始提供。
