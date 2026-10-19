---
title: "Go 的 chan 底层数据结构是什么？"
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go"]
learning_status: reading
created_at: "2026-10-19T19:27:56+08:00"
updated_at: "2026-10-19T19:27:56+08:00"
learning_status_changed_at: "2026-10-19T19:39:47.235+08:00"
---

Go 的 chan 在 [[go-channel-sources|runtime]] 中由 [[assets/go-hchan.go|hchan 结构体]]实现，核心可以记成 **「环形缓冲区、两个等待队列、一把锁」**，再加上类型和状态信息。

有缓冲 Channel 用 `buf` 指向存放元素的数组，`dataqsiz` 表示容量，`qcount` 表示当前元素数量，`sendx` 和 `recvx` 分别记录下一次写入、读取的位置，下标到末尾后回到开头。`sendq` 和 `recvq` 分别保存等待发送、接收的记录，节点是 `sudog`，关联等待的 goroutine 和收发数据。

`lock` 保护共享状态，`closed` 记录是否关闭，`elemtype` 和 `elemsize` 记录元素类型与大小。**「无缓冲 Channel 的容量为 0，也有等待队列和锁」**；收发双方配对后直接传递数据，无法立即完成的阻塞收发会入队并挂起 goroutine。
