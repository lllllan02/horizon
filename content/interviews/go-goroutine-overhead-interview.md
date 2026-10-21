---
title: "为什么 Go 的协程开销小？"
aliases: ["Goroutine 开销", "Go 协程为什么轻量"]
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go", "调度"]
learning_status: organized
created_at: "2026-10-20T18:36:58+08:00"
updated_at: "2026-10-20T19:34:07+08:00"
learning_status_changed_at: "2026-10-20T19:34:53.140+08:00"
---

[[coroutine#Go 的 goroutine|Go 的协程]]由[[go-gmp-interview|运行时调度]]，多个协程可以**复用[[thread|操作系统线程]]**，协程之间的切换通常在用户态完成，所以能减少线程创建和调度切换的开销。

另外，协程的[[go-gmp-sources#小栈与用户态切换|初始栈比较小]]，空间不够时可以**动态扩容**，因此栈内存的初始开销也比较小。
