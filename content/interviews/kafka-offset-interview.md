---
title: "Kafka 消费者如何通过 Offset 拉取消息？"
category: "Kafka"
parent: kafka-interview-index
tags: ["面试", "Kafka", "消息队列"]
learning_status: organized
created_at: "2026-10-19T21:42:14+08:00"
updated_at: "2026-10-19T21:42:14+08:00"
learning_status_changed_at: "2026-10-19T21:50:00.714+08:00"
---

Offset 表示消息在某个 Partition 日志中的位置。消费者会为自己负责的每个分区维护一个[[kafka-offset-sources#当前读取位置怎样参与拉取|当前读取位置（position）]]，表示接下来从哪里读。拉取时，客户端向对应 Broker 发送 Fetch 请求，带上分区和起始 Offset，Broker 据此返回一批消息，客户端再推进读取位置。

另外，Broker 端会保存消费者组在每个 Topic 分区上[[kafka-offset-sources#提交的位置为什么需要单独保存|已经提交的位置（committed offset）]]，通过组协调器写入内部 Topic `__consumer_offsets`。提交的值表示恢复后接下来要读取的位置。按顺序处理消息时，如果已经处理完 Offset 为 100 的消息，下一条是 101，就提交 101。

消费者重启，或者重平衡后由其他消费者接手分区时，通常会取回这个分区已提交的位置，作为继续拉取的起点。如果没有提交记录，或者对应位置已经失效，就按 `auto.offset.reset` 的配置选择起点或报错。

所以，**「当前读取位置和已提交位置要分开理解」**：正常拉取可以持续推进，不需要每批提交后才能继续。拉到消息也不代表业务处理完成；如果要求处理成功后再记录进度，就要在处理完成后提交。处理完但提交前宕机，恢复后仍可能重复消费。
