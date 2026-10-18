---
title: "Reactive Streams：用需求量约束上游发送"
category: "服务治理"
tags: ["背压", "流量控制", "队列"]
learning_status: pending
created_at: "2026-10-18T23:47:18+08:00"
updated_at: "2026-10-18T23:47:18+08:00"
source:
  - "https://www.reactive-streams.org/"
  - "https://github.com/reactive-streams/reactive-streams-jvm/blob/v1.0.4/README.md"
---

[Reactive Streams](https://www.reactive-streams.org/#the-problem)针对跨异步边界的数据传递，要求生产者服从消费者的接收需求，避免快速数据源迫使下游无限缓存。非阻塞[[service-backpressure|背压]]是这套协议的核心约束。

## 按需求量发送

在 JVM 1.0.4 规范中，订阅者通过 `Subscription.request(n)` 增加可接收额度；发布者发送的数据项不能超过累计请求量。订阅者处理一部分数据后，可以继续申请额度，让后续输入跟随消费进度。它控制的是可继续发送的数据量，不直接规定业务任务如何调度。[Subscriber 与 Subscription 规则](https://github.com/reactive-streams/reactive-streams-jvm/blob/v1.0.4/README.md#2-subscriber-code)

规范不要求每次只申请一个元素；批量申请可以摊薄请求额度的开销，但额度必须与可处理或缓冲的容量相容。需求反馈本身要求及时返回，不能为了实现背压长时间阻塞协议调用。

## 缓冲为什么仍需要边界

申请量与已处理量限制了后续还可能到达多少数据。输入源无法暂停时，发布者仍须遵守接收额度，并自行选择缓冲或丢弃等方式；背压协议不会使外部数据源自动停下，也不会凭空增加处理能力。[Subscriber-controlled queue bounds](https://github.com/reactive-streams/reactive-streams-jvm/blob/v1.0.4/README.md#subscriber-controlled-queue-bounds)

本导读节选异步背压、需求量和队列边界，不覆盖全部信号与并发规则；依据 JVM 1.0.4 规范及 2026-10-18 官网说明，未运行实现。
