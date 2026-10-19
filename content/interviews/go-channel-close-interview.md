---
title: "怎么防止 Go Channel 重复关闭？"
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go"]
learning_status: organized
created_at: "2026-10-19T11:24:03+08:00"
updated_at: "2026-10-19T11:24:03+08:00"
learning_status_changed_at: "2026-10-19T11:26:08.642+08:00"
---

我会尽量把 Channel（通道）的关闭权交给生产方，并明确由谁负责关闭。因为**「从已关闭的 Channel 继续接收不会 panic，但继续发送会 panic」**，重复关闭也会 panic。所以应该由生产方判断什么时候已经发送完、后续不会再发送，再执行关闭。

如果有多个生产者，可以通过 **「sync.WaitGroup 等待所有生产者完成发送并退出」**，再由唯一的协调者统一关闭 Channel。每个生产者只报告自己完成，不各自关闭，这样既避免重复关闭，也避免其他生产者还没发完就提前关闭。

消费者通过 `range` 持续接收，Channel 关闭后仍能读完缓冲区里剩余的数据，**「关闭且数据读完后，range 才会退出」**。如果只是暂时没有消息，但 Channel 没有关闭，`range` 仍然会阻塞等待。
