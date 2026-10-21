---
title: "介绍一下 Kafka 的整体架构？"
category: "Kafka"
parent: kafka-interview-index
tags: ["面试", "Kafka", "消息队列"]
learning_status: organized
created_at: "2026-10-19T16:59:29+08:00"
updated_at: "2026-10-21T10:37:55+08:00"
learning_status_changed_at: "2026-10-21T10:43:10.855+08:00"
---

Kafka 是一个分布式事件流平台，通过保存消息，让生产者和消费者解耦，按各自的速度运行。

## 整体组成

- **客户端**包括 Producer 和 Consumer，也就是生产者和消费者，分别负责写入消息和拉取消息。
- **Broker 集群**负责消息的存储和读写，每台 Broker 承担其中一部分数据和请求。
- **[[kafka-architecture-sources#Controller 管理集群元数据|Controller]]**负责管理集群元数据、检测 Broker 故障和协调分区 Leader 切换。采用 KRaft 时，多个 Controller 共同维护元数据，由活跃 Controller 执行管理工作。

## 数据组织与分工

消息按 Topic 做逻辑分类，生产者向指定 Topic 写入，消费者订阅 Topic。每个 Topic 又可以拆成多个 Partition，分布在不同 Broker 上，让多台机器[[kafka-throughput-interview|并行承担存储和读写]]。每个分区内部是一条有序追加的日志，顺序保证以分区为边界。

每个分区还可以配置[[kafka-reliability-interview|多个副本]]，由 Leader 接收生产者的写入，Follower 复制数据。不同分区的 Leader 可以分散在不同 Broker 上；某个 Leader 故障后，就由符合条件的副本接替。

消费者通常通过消费者组来分工。普通组内的消费者分摊分区，一个分区同一时刻只交给一个消费者；不同组则独立消费，通过 [[kafka-offset-interview|Offset]] 分别记录进度。消息不会因为被消费就直接删除，只要数据还保留着，就可以重新读取。
