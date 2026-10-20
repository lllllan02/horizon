---
title: "Kafka 面试题"
category: "Kafka"
parent: interview-hub
tags: ["面试", "Kafka", "消息队列"]
type: overview
learning_status: pending
created_at: "2026-10-19T10:51:27+08:00"
updated_at: "2026-10-19T21:42:14+08:00"
---

围绕 Kafka 的设计与使用整理已保存的面试题，从整体架构开始，再了解高吞吐机制、分区数量的取舍、消息顺序保证、日志刷盘、写入可靠性、Offset 拉取与恢复，以及消费积压排查。

## 架构与吞吐

- [[kafka-architecture-interview|介绍一下 Kafka 的整体架构？]]
- [[kafka-throughput-interview|Kafka 是怎么实现高吞吐的？]]

## 分区与顺序

- [[kafka-partition-count-interview|Kafka 的分区是不是越多越好？]]
- [[kafka-ordering-interview|Kafka 能保证消息顺序吗？]]

## 写入与可靠性

- [[kafka-flush-interview|Kafka 顺序追加写入后，消息会立即落盘吗？]]
- [[kafka-reliability-interview|Kafka 如何保证消息写入的可靠性？]]

## 消费与恢复

- [[kafka-offset-interview|Kafka 消费者如何通过 Offset 拉取消息？]]
- [[kafka-consumer-lag-interview|消费者出现大量消息积压，怎么排查和处理？]]
