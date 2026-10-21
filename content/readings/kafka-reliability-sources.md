---
title: "Kafka 副本与写入确认导读"
category: "Kafka"
type: article
tags: ["Kafka", "消息队列"]
learning_status: pending
created_at: "2026-10-19 11:07:51"
updated_at: "2026-10-19 11:07:51"
source:
  - "https://kafka.apache.org/43/design/design/"
  - "https://kafka.apache.org/43/configuration/producer-configs/#acks"
  - "https://kafka.apache.org/43/configuration/topic-configs/#min.insync.replicas"
---

**「Kafka 用日志副本降低单机故障丢失数据的风险，用 acks 决定生产者等待的确认条件。」** 本篇节选 Kafka 4.3 的副本设计与配置说明，聚焦消息写入和 Leader 故障，不覆盖消费端的处理与 Offset 提交。

## 副本如何复制与接替

[Replication](https://kafka.apache.org/43/design/design/#replication)以分区为复制单位：一个 Leader 接收写入，Follower 主动拉取并追加到自己的日志。Follower 可能暂时落后，因此「存在副本」不等于「这条消息已经有多份」。Kafka 维护同步副本集合 ISR，包含 Leader；失效或复制落后过多的副本会被移出。

[副本选举与故障边界](https://kafka.apache.org/43/design/design/#unclean-leader-election-what-if-they-all-die)解释了为什么不能任意找一个副本接替：落后副本可能缺少已经确认的数据。正常切换需要选择符合条件的副本；允许落后副本强行接替可能以丢失数据换取可用性。具体候选资格还需结合选举配置与 ELR 特性判断，不能把「数据最多」当作完整选举规则。

## acks 决定等待什么确认

[Producer Configs 的 acks](https://kafka.apache.org/43/configuration/producer-configs/#acks)给出三个取值语义：

| 配置 | 生产者认为发送成功的条件 | 必要边界 |
| --- | --- | --- |
| `0` | 不等待服务端确认 | 不能保证 Broker 已经收到 |
| `1` | Leader 追加本地日志后确认 | 尚未复制时 Leader 故障，消息可能丢失 |
| `all`，等价于 `-1` | 当前 ISR 中全部副本完成复制 | 不代表配置的全部副本都已复制，更不代表每份数据都已强制刷盘 |

这几种配置改变的是生产者等待条件；使用 `0` 或 `1` 不表示关闭副本复制，也不能将数字理解为任意指定要等几个 Follower。

## 最低同步副本数如何配合

[min.insync.replicas](https://kafka.apache.org/43/configuration/topic-configs/#min.insync.replicas)与 `acks=all` 配合，为成功写入设置最低同步副本数，计数包含 Leader。例如三副本、最低同步副本数为二：ISR 有三个时仍等三个完成复制；ISR 剩两个时可以成功；不足两个时无法满足该写入要求。这里说明常规 ISR 语义；启用 ELR 时还需核对该配置页标注的语义变化。

因此，仅设置 `acks=all` 仍要检查最低同步副本数，避免 ISR 退化为仅剩 Leader 时仍返回成功。

## 复制完成与物理落盘要分开

[Replicated Logs](https://kafka.apache.org/43/design/design/#replicated-logs-quorums-isrs-and-state-machines-oh-my)明确说明，Kafka 不要求每次写入执行 `fsync`，恢复的副本重新加入 ISR 前需要重新同步。多副本主要覆盖部分节点故障；如果所有相关副本同时故障并丢失未刷盘的数据，确认并不能提供无条件的不丢失保证。页缓存与刷盘条件由[[kafka-throughput-sources#页缓存与零拷贝分别减少什么开销|高吞吐设计导读]]解释。

本篇依据文档核对，未执行副本故障或断电实验。
