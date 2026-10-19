---
title: "Go runtime 源码导读：Channel 数据结构"
category: "Go"
tags: ["Go"]
learning_status: pending
created_at: "2026-10-19T19:27:56+08:00"
updated_at: "2026-10-19T19:27:56+08:00"
source: "https://go.dev/src/runtime/chan.go"
---

Go runtime 用 **「hchan 统一管理数据存储与收发等待」**。本篇仅摘取 2026-10-19 查阅的官方在线源码中的结构及基本收发路径；字段属于运行时实现细节，可能随版本变化，不覆盖 `select`、定时器与关闭流程。

[hchan 与 waitq](https://go.dev/src/runtime/chan.go#L34) 中，`buf` 指向环形队列数组；`dataqsiz`、`qcount`、`sendx`、`recvx` 管理容量、数量和读写位置。`sendq`、`recvq` 用首尾指针组织 `sudog` 等待记录；另有元素类型、大小、关闭状态和保护共享状态的 `lock`。

[chansend](https://go.dev/src/runtime/chan.go#L229) 先匹配等待的接收者，否则在缓冲区有空位时写入；仍不能完成的阻塞发送登记 `sudog` 后挂起。[chanrecv](https://go.dev/src/runtime/chan.go#L602) 则匹配发送者或读取缓冲区；无缓冲时直接接收发送者的数据。这说明 **「缓冲区负责暂存数据，等待队列负责登记尚未完成的收发」**，两者承担不同职责。
