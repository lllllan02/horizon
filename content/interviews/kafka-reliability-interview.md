---
title: "Kafka 如何保证消息写入的可靠性？"
category: "Kafka"
parent: kafka-interview-index
tags: ["面试", "Kafka", "消息队列"]
learning_status: organized
created_at: "2026-10-19T11:07:51+08:00"
updated_at: "2026-10-19T11:07:51+08:00"
learning_status_changed_at: "2026-10-19T11:11:56.811+08:00"
---

Kafka 通常不要求每条消息进来后都立即[[kafka-flush-interview|强制刷盘]]再返回确认，它的可靠性设计还依靠多副本：每个分区可以配置多个副本，分布在不同的 Broker 上。

生产者把消息发给 Leader，Follower 主动从 Leader 拉取消息，复制到自己的日志中。生产者通过[[kafka-reliability-sources#acks 决定等待什么确认|acks 配置]]决定等到什么条件，才认为发送成功：

- `acks=0`：生产者不等待 Broker 的确认，不能保证 Broker 已经收到消息。
- `acks=1`：Leader 写入自己的本地日志后就确认，不等待 Follower 复制完成。
- `acks=all`：等待当前同步副本集合 ISR 中的全部副本完成复制；ISR 包含 Leader，不一定包含配置的全部副本。

如果 Leader 宕机，Kafka 可以从符合选举条件的副本中选出新的 Leader，继续提供服务。但如果使用 `acks=1`，Leader 确认后、Follower 还没复制到消息时就故障，这条消息仍可能丢失。

所以，多副本复制、确认条件和故障切换需要配合使用；副本完成复制，也不等于每个副本都已经强制刷盘。
