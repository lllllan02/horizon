---
title: "Go 的 chan 底层数据结构是什么？"
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go"]
learning_status: organized
created_at: "2026-10-19T19:27:56+08:00"
updated_at: "2026-10-19T20:17:01+08:00"
learning_status_changed_at: "2026-10-19T20:17:55.246+08:00"
---

Go 的 chan 在 [[go-channel-sources|runtime]] 中由 [[assets/go-hchan.go|hchan 结构体]]实现，主要有 **「环形缓冲区和两个等待队列」**。有缓冲时，环形缓冲区用来存数据；两个等待队列分别记录等待发送和等待接收的[[coroutine#Go 的 goroutine|协程]]。

收发暂时无法完成时，协程就会挂起等待；**「收发条件满足时」**，再完成数据传递并唤醒对应的等待协程。另外还有一把锁，用来保护这些共享状态。
