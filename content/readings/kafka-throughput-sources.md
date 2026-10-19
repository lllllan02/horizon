---
title: "Kafka 高吞吐设计导读"
category: "Kafka"
type: article
tags: ["Kafka", "消息队列"]
learning_status: pending
created_at: "2026-10-19T10:34:16+08:00"
updated_at: "2026-10-19T11:01:36+08:00"
source:
  - "https://kafka.apache.org/43/design/design/"
  - "https://docs.confluent.io/cloud/current/client-apps/optimizing/throughput.html"
  - "https://developer.confluent.io/learn/kafka-performance/"
  - "https://kafka.apache.org/43/configuration/broker-configs/"
---

**「Kafka 通过分区增加并行度，再用顺序追加、批处理、页缓存和零拷贝降低每条消息的处理成本。」** 本篇节选 Apache Kafka 4.3 设计文档与 Confluent 的吞吐调优、性能测试说明，只覆盖高吞吐的主要机制与必要边界，不展开完整参数调优。

## 分区让多台机器共同处理

Confluent 的 [Number of Partitions](https://docs.confluent.io/cloud/current/client-apps/optimizing/throughput.html#number-of-partitions)把分区定义为并行处理的单位：不同分区可以由不同 Broker 承担读写，也可以由不同消费者并行处理。将负载分散到多台机器，才能利用更多 CPU、磁盘和网络资源。

原文同时要求结合生产、消费能力和 Key 分布选择分区数。热点分区仍可能成为瓶颈，单纯增加分区不能保证吞吐线性增长。

## 顺序追加之后，还要减少小操作

Kafka [Persistence](https://kafka.apache.org/43/design/design/#persistence)从随机磁盘访问的寻道成本出发，采用日志文件的追加写入。顺序访问也便于操作系统进行预读和合并写入；这里描述的是分区日志的访问模式，不意味着整台 Broker 的所有磁盘操作都连续。

[Efficiency](https://kafka.apache.org/43/design/design/#efficiency)继续指出：即使访问模式合理，大量小 I/O 仍有固定开销。生产者把同一分区的消息聚成批次，Broker 成批追加，消费者成批拉取，让一次请求或写入承载更多消息，摊薄网络往返、协议处理和系统调用的成本。

[Asynchronous send](https://kafka.apache.org/43/design/design/#asynchronous-send)说明生产者可先在内存中积累消息再发送；等待更多消息有助于形成大批次，但可能增加单条消息的等待时间。高吞吐与最低延迟需要结合业务要求取舍。

## 页缓存与零拷贝分别减少什么开销

Kafka 的 [Don’t fear the filesystem](https://kafka.apache.org/43/design/design/#dont-fear-the-filesystem)解释了页缓存（Page Cache）：操作系统把文件数据缓存在内存中。写日志通常先进入页缓存，不必逐条强制刷盘；消费者及时读取新数据时，可以直接命中缓存，减少磁盘读取。进入页缓存不等于已持久化到物理介质。

[Broker 刷盘配置](https://kafka.apache.org/43/configuration/broker-configs/#log.flush.interval.messages)还提供按分区累计消息数量的 `log.flush.interval.messages`，以及按时间的 `log.flush.interval.ms`；后者需要配合 `log.flush.scheduler.interval.ms` 的后台检查周期。4.3 默认消息阈值和检查间隔均为极大值，时间条件未单独设置，因此不能归纳成「Kafka 默认每秒主动刷盘」。常规写入通常依赖操作系统异步回写；配置时间条件也不等于严格在指定时刻完成物理落盘。

[Efficiency 的文件发送路径](https://kafka.apache.org/43/design/design/#efficiency)进一步比较了传统发送与 `sendfile`：传统方式先把文件数据从内核缓存复制到应用缓冲区，再写回内核网络缓冲区；零拷贝路径省去这些用户态中转，减少复制与 CPU 开销。它主要优化 Broker 向消费者发送日志数据，并不表示整条生产、存储、消费链路没有复制；4.3 文档明确说明，启用 SSL 时 Kafka 不使用这一 `sendfile` 路径。

## 批量压缩与消费进度也是补充因素

[End-to-end Batch Compression](https://kafka.apache.org/43/design/design/#end-to-end-batch-compression)说明，同类消息之间常有重复内容，整批压缩通常比逐条压缩更有效。消息可以以压缩形式存储和传输，减少磁盘与带宽占用；Confluent 的 [Compression](https://docs.confluent.io/cloud/current/client-apps/optimizing/throughput.html#compression)也提醒，压缩算法的计算成本不同，收益需要结合瓶颈判断。

Kafka [Consumer Position](https://kafka.apache.org/43/design/design/#consumer-position)还解释了常规消费组的状态成本：以每个分区的消费位点（Offset）记录进度，避免为每条消息维护复杂的投递与确认状态。它适合作为补充解释，口述时可先抓住前述读写与传输主线。消费进度与保留、重放的关系由[[messaging-patterns-sources#历史为什么能够重新处理|消息通信与事件处理模式导读]]解释。

## 性能数据要连同条件阅读

Confluent 的 [Performance 测试](https://developer.confluent.io/learn/kafka-performance/)展示了批处理和缓存如何发挥作用：吞吐测试采用 100 个分区、1 KB 消息、三个 Broker 和多个生产者、消费者，生产者使用 1 MB 批次及 10 ms 等待，并保留副本确认要求；延迟测试则刻意让消费者跟上生产者，使读取由缓存服务。这些结果支持相应机制的解释，不能当成任意部署都能达到的吞吐承诺。

本篇未执行压测；批大小、等待时间与压缩算法的具体选择仍需在实际负载下验证。
