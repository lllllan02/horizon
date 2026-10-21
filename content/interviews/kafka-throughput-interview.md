---
title: "Kafka 是怎么实现高吞吐的？"
category: "Kafka"
parent: kafka-interview-index
tags: ["面试", "Kafka", "消息队列"]
learning_status: organized
created_at: "2026-10-19 10:34:16"
updated_at: "2026-10-19 10:37:47"
learning_status_changed_at: "2026-10-19 10:53:59.155"
---

Kafka 有 Topic 分区的概念，不同分区可以分布在不同的 Broker 上，通过并行读写实现水平扩容，提高整体吞吐量。

它底层采用分布式日志存储，消息进来后直接追加到分区日志文件的末尾，主要是[[kafka-flush-interview|顺序写入]]，减少了随机 I/O 的开销，所以写入效率比较高。

另外还有批处理和[[kafka-throughput-sources#页缓存与零拷贝分别减少什么开销|零拷贝]]：批处理把多条消息放在一起处理，摊薄网络请求和 I/O 操作的开销；零拷贝则在适用的消费发送路径下减少内核态与用户态之间的数据复制，降低 CPU 开销。这些设计共同支撑了 Kafka 的高吞吐。
