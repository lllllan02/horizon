---
title: "Go 官方资料：内存滞留与清理责任"
category: "Go"
tags: ["Go", "内存管理"]
learning_status: pending
created_at: "2026-10-20T20:05:17+08:00"
updated_at: "2026-10-20T20:05:17+08:00"
source:
  - "https://go.dev/blog/slices-intro#a-possible-gotcha"
  - "https://pkg.go.dev/strings#Clone"
  - "https://pkg.go.dev/context"
  - "https://pkg.go.dev/net/http#Client.Do"
---

这些官方资料说明：**小片段可能保留大块底层内存，取消函数与资源关闭也有各自的清理责任。** 本导读节选与内存滞留有关的内容，核对于 2026-10-20；未运行示例，不覆盖完整 GC 或 HTTP 连接管理机制。

## 小片段保留大块内存

[Go Slices: usage and internals 的 A possible gotcha](https://go.dev/blog/slices-intro#a-possible-gotcha)用读取文件、返回其中一小段数字的例子说明：重切片不会复制底层数组。返回的小切片仍引用原数组，即使其余文件内容已经无用，整块数组也无法回收。需要长期保留小片段时，可把它复制到独立的切片，再让原数组失去引用。

[strings.Clone](https://pkg.go.dev/strings#Clone)文档说明，该函数将字符串复制到新的内存中，可用于只需保留大字符串中一小段的情况，避免保留过多内存。它从 Go 1.18 提供；空字符串不会产生新分配。文档也提醒，复制本身有成本，应结合内存分析判断是否需要，不能把所有子串都判成泄漏。

## 取消与资源清理

[context 包的 Overview](https://pkg.go.dev/context)说明，`WithCancel`、`WithDeadline` 和 `WithTimeout` 返回的取消函数会取消子树、移除父 Context 对子 Context 的引用，并停止关联的定时器。遗漏调用可能让子 Context 及其后代保留到父 Context 取消；有截止时间时也可能在到期后释放。因此应及时调用 `cancel()`，不能笼统称为永久泄漏。取消通知也不保证工作协程已经退出。

[http.Client.Do](https://pkg.go.dev/net/http#Client.Do)要求：没有返回错误时，由调用者关闭响应 Body；若没有读到 EOF 并关闭，底层 Transport 可能无法复用持久 TCP 连接。这里直接说明的是资源清理和连接复用责任；是否同时存在持续的堆内存滞留，还需结合实际引用与协程生命周期判断。
