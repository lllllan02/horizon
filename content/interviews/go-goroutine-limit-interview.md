---
title: "为什么不能无限制地开 Go 协程？会有什么后果？"
aliases: ["Goroutine 数量限制", "协程过多的后果"]
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go", "并发"]
learning_status: organized
created_at: "2026-10-20 18:34:48"
updated_at: "2026-10-20 19:35:58"
learning_status_changed_at: "2026-10-21 10:01:18.497"
---

**[[coroutine#Go 的 goroutine|协程]]再轻量，机器和系统的承受能力也有上限。** 无限制地创建协程，主要会有三个问题：

1. **[[go-pipelines-summary#协程需要自行退出|内存占用增加]]**：每个协程都需要栈等内存，任务还会持有数据；大量积压时，严重的就可能 [[go-oom-interview|OOM]]。
2. **CPU 竞争加剧**：可运行的协程太多，会增加[[go-gmp-interview|调度]]、切换和排队的开销，CPU 饱和后继续增加协程，可能让响应更慢。
3. **其他资源耗尽或下游过载**：并发请求过多，可能耗尽连接、文件描述符，或超过数据库等下游的处理能力，导致等待、超时和失败。

所以需要根据系统容量[[concurrency-control|控制并发]]，例如使用[[go-pool-interview|协程池]]。
