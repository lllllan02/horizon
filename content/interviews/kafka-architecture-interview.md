---
title: "介绍一下 Kafka 的整体架构？"
category: "Kafka"
parent: kafka-interview-index
tags: ["面试", "Kafka", "消息队列"]
learning_status: pending
created_at: "2026-10-19T16:59:29+08:00"
updated_at: "2026-10-19T17:12:34+08:00"
---

Kafka 的主要链路是**「生产者写入 → Broker 集群存储 → 消费者拉取」**。另外由[[kafka-architecture-sources#Controller 管理集群元数据|Controller]]管理集群元数据、协调故障切换，现代 Kafka 使用 KRaft 实现这部分管理。

消息按 Topic 分类，每个 Topic 拆成多个分区，分布在不同 Broker 上，实现[[kafka-throughput-interview|并行读写]]。每个分区是一条有序日志，还可以配置多个副本：Leader 接收写入，Follower 复制数据；Leader 故障时，由符合条件的副本接替，配合[[kafka-reliability-interview|写入确认机制]]提供可靠性保证。

消费端通常通过消费者组分工：**「同组内分摊分区，不同组独立消费」**。同组内一个分区同一时刻只分配给一个消费者，各组通过 Offset 分别记录每个分区的消费进度。
