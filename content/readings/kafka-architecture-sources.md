---
title: "Kafka 整体架构与组件分工导读"
category: "Kafka"
type: article
tags: ["Kafka", "消息队列"]
learning_status: pending
created_at: "2026-10-19 16:59:29"
updated_at: "2026-10-19 16:59:29"
source:
  - "https://kafka.apache.org/43/getting-started/introduction/"
  - "https://kafka.apache.org/43/design/design/"
  - "https://kafka.apache.org/43/operations/kraft/"
---

Kafka 将客户端读写、分区日志存储和集群元数据管理分开：分区提供并行度，副本支持故障恢复，消费者组组织消费分工。本篇节选 Kafka 4.3 官方介绍、设计与 KRaft 文档，聚焦这些组件如何配合，不展开 Connect、Streams、事务协议和部署调优。

## 从客户端到分区日志

[Introduction](https://kafka.apache.org/43/getting-started/introduction/#main-concepts-and-terminology)把 Producer、Consumer 定义为发布和读取事件的客户端应用，Broker 则承载存储和读写服务。生产者不必等待消费者完成处理，双方通过 Kafka 中保存的事件衔接。

Topic 是消息分类，Partition 是可分布到不同 Broker 上的有序日志。消息实际追加到某个分区，并获得分区内的 Offset；不同分区可以并行读写，分区之间没有统一顺序。扩展并行度与保持全局顺序因而存在取舍，性能机制由[[kafka-throughput-sources|高吞吐设计导读]]展开。

[The Producer](https://kafka.apache.org/43/design/design/#the-producer)说明，生产者通过元数据获知分区 Leader 的位置，随后直接向对应 Broker 写入，无需额外的消息路由层。客户端需要认识分区和 Leader，不能把任意一个入口 Broker 理解成所有业务消息的统一中转节点。

## 副本角色属于分区

[Replication](https://kafka.apache.org/43/design/design/#replication)以分区为复制单位：Leader 接收写入，Follower 主动拉取并追加到自己的日志。不同分区的 Leader 可以分散在不同 Broker 上，因此各 Broker 可以同时承担写入负载；一台 Broker 也可以同时承载 Leader 和 Follower 两种角色，分别属于不同分区。

Leader 故障后需要从符合条件的副本中选出接任者。Follower 可能落后，存在多个副本并不能单独证明一条消息已经安全复制；确认条件与故障边界由[[kafka-reliability-sources|副本与写入确认导读]]解释。

## 消费分工与保存期限相互独立

[The Consumer](https://kafka.apache.org/43/design/design/#the-consumer)采用拉取方式，消费者指定分区中的位置获取一批数据。[Consumer Position](https://kafka.apache.org/43/design/design/#consumer-position)将普通消费者组的分工单位设为分区：同组内一个分区同一时刻只分配给一个消费者，消费进度可以用每个分区的一个 Offset 表示，并定期保存用于恢复。消费者组成员变化时，分区会重新分配；不同组的进度相互独立。

例如一个三分区 Topic 可以由组内两个消费者分别负责两个分区和一个分区，另一个组仍可独立读取全部三个分区。进度改变不会直接删除日志；保留策略决定数据何时清理，消费者可以回退到仍保留的位置重读。这种解耦使不同业务能够使用不同处理速度，重放边界由[[messaging-patterns-sources#历史为什么能够重新处理|消息通信与事件处理模式导读]]补充。

上述分工适用于普通 Consumer Group。[The Share Consumer](https://kafka.apache.org/43/design/design/#the-share-consumer)另有共享分区和逐条确认的模型，不应把普通消费者组的独占分区规则套到 Share Group。

## Controller 管理集群元数据

[KRaft 的 Process Roles 与 Controllers](https://kafka.apache.org/43/operations/kraft/#configuration)区分 Broker 和 Controller 角色：前者承载业务日志和读写，后者组成元数据仲裁组，通过 Raft 复制元数据，由一个活跃 Controller 负责管理，其他 Controller 热备。角色可以部署在同一进程，也可以分开；官方不建议在关键部署中混合角色，以便隔离资源并分别扩缩容。

[Replica Management](https://kafka.apache.org/43/design/design/#replica-management)说明 Controller 检测 Broker 故障并协调分区 Leader 的切换。活跃 Controller 管的是集群，分区 Leader 管的是对应分区的数据写入；两种领导角色不能混为一谈，也不能把 KRaft 元数据的 Raft 复制等同于业务分区的副本复制协议。

本篇依据文档核对，未部署集群或执行故障切换实验。
