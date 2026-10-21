---
title: "Go 的 Context 是什么？怎么使用？"
aliases: ["Go Context 的结构与作用"]
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go"]
learning_status: organized
created_at: "2026-10-19 15:27:50"
updated_at: "2026-10-19 15:27:50"
learning_status_changed_at: "2026-10-19 15:29:51.201"
---

**Context 是一个接口，主要用于在调用链或者多个 [[coroutine#Go 的 goroutine|goroutine]] 之间传递取消信号、截止时间，以及请求相关的数据。** 这样一次请求取消或超时后，下游任务就能收到通知，及时结束工作。

接口本身有 `Deadline()`、`Done()`、`Err()` 和 `Value()` 四个方法，分别用来获取截止时间、接收取消通知、查询取消原因，以及读取请求相关的数据。

使用时，`context` 包提供了 [[go-context-cancel-interview|WithCancel]]、`WithTimeout`、`WithDeadline` 和 `WithValue` 等函数，分别用于派生支持手动取消、设置超时时长、设置截止时间，以及携带键值对的 Context。前三种还会返回一个 `cancel` 函数，通常配合 `defer cancel()` 及时释放相关资源。

**「设置超时不会直接关闭 goroutine，Context 只起通知作用。」** 下游 goroutine 需要主动监听 `ctx.Done()`，在它关闭后配合退出；`ctx.Err()` 用来判断取消原因，比如主动取消还是超时。也可以把 Context 传给支持取消的 API，由它响应取消。
