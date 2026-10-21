---
title: "Go 官方源码导读：协作式与异步抢占"
category: "Go"
tags: ["Go"]
learning_status: pending
created_at: "2026-10-19 11:24:21"
updated_at: "2026-10-19 11:24:21"
source:
  - "https://go.dev/src/runtime/preempt.go"
  - "https://go.dev/src/runtime/proc.go"
  - "https://go.dev/doc/go1.14#runtime"
---

Go 运行时的抢占说明区分了同步安全点与异步安全点：**「同步方式等待正在运行的 [[coroutine#Go 的 goroutine|goroutine]] 检查抢占请求，异步方式借助操作系统机制打断执行，再判断能否安全暂停。」** 本导读只选取这两种方式及其适用边界，不覆盖完整调度算法；依据 2026-10-19 查阅的官方在线源码，未运行抢占实验。

## 同步检查怎样响应抢占请求

[preempt.go 文件开头的机制说明](https://go.dev/src/runtime/preempt.go)解释，同步安全点通过复用函数入口的栈边界检查实现。运行时把 goroutine 的栈边界标记设为特殊值，使后续栈检查进入运行时；运行时识别出这是抢占请求，再转入抢占处理。

[proc.go 中的 preemptone](https://go.dev/src/runtime/proc.go)设置 `gp.preempt` 和 `gp.stackguard0`，对应发出请求的过程。因此，经过函数入口不等于一定发生抢占，还需要存在抢占请求并满足处理条件。一直不经过这类检查点的紧密循环，是仅依赖这种方式的局限。

## 异步方式为什么能处理紧密循环

[Go 1.14 的 Runtime 发布说明](https://go.dev/doc/go1.14#runtime)宣布引入异步抢占，使没有函数调用的循环也能被抢占，避免这类循环阻碍调度或显著延迟垃圾回收。该发布说明同时列出了当时不支持的平台，因此版本变化不应被理解为所有平台都使用同一种实现。

[preempt.go 的异步抢占说明](https://go.dev/src/runtime/preempt.go)给出了处理过程：借助信号等操作系统机制打断[[thread|线程]]，检查运行状态与当前位置是否满足异步安全点条件；满足条件时调整执行上下文，使线程恢复后进入 `asyncPreempt`，保存寄存器并进入调度器。安全点需要保证运行时能够正确识别栈和寄存器中的指针等信息。

所以，异步抢占减少了对函数入口检查的依赖，但**「可以主动打断，不代表在任意指令位置都能立即切换」**。信号等具体手段也取决于平台支持。
