---
title: "Kafka 顺序追加写入后，消息会立即落盘吗？"
category: "Kafka"
parent: kafka-interview-index
tags: ["面试", "Kafka", "消息队列"]
learning_status: organized
created_at: "2026-10-19 11:01:36"
updated_at: "2026-10-19 11:01:36"
learning_status_changed_at: "2026-10-19 11:08:17.573"
---

Kafka 的顺序追加是它的日志写入设计，但不代表每条消息写入后都会立刻刷到磁盘。写入通常先进入操作系统的页缓存（Page Cache），后续再刷到磁盘。

通常主要由操作系统异步回写，Kafka 也可以配置[[kafka-throughput-sources#页缓存与零拷贝分别减少什么开销|刷盘条件]]，主要有两种：

1. 按时间间隔：定期检查，把达到刷盘时间条件的数据从页缓存刷到磁盘。
2. 按消息数量：分区日志累计写入一定数量的消息后，触发刷盘。

所以，不能把顺序追加理解成每条消息都同步落盘，也不能直接说 Kafka 默认每秒刷盘。
