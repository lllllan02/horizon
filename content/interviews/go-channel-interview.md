---
title: "Go 的 Channel 一般怎么用？"
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go"]
learning_status: organized
created_at: "2026-10-19T16:17:49+08:00"
updated_at: "2026-10-19T16:17:49+08:00"
learning_status_changed_at: "2026-10-19T16:19:36.546+08:00"
---

Channel 主要用于 **「goroutine 之间的数据传递和同步协作」**。可以用来发送完成通知，也可以传递具体数据，比如分发任务、收集处理结果。

使用时需要考虑是否设置缓冲区。**「无缓冲 Channel 的发送和接收需要配对」**，先到的一方会等待；[[go-channel-structure-interview|有缓冲 Channel]] 可以暂存数据，但缓冲区满时发送会阻塞，缓冲区为空且未关闭时接收会阻塞。所以要安排好收发双方的执行和退出，避免一直阻塞等待。
