---
title: "Quorum 与多数派：官方资料导读"
category: "分布式系统"
type: article
tags: ["Quorum", "多数派", "共识"]
learning_status: pending
created_at: "2026-10-19T20:39:27+08:00"
updated_at: "2026-10-19T20:39:27+08:00"
source:
  - "https://etcd.io/docs/v3.6/learning/glossary/#quorum"
  - "https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/#quorum"
  - "https://zookeeper.apache.org/doc/current/zookeeperOver.html"
  - "https://zookeeper.apache.org/doc/current/zookeeperObservers.html"
---

**「Quorum 的具体含义要结合协议和决策阶段；多数派是常见规则，但不是这个词在所有系统中的固定含义。」** 本篇节选 etcd 3.6、Redis Sentinel 和 ZooKeeper 官方说明，只覆盖人数门槛与参与范围，不展开完整共识协议。

## 多数派是常见的 quorum 规则

etcd 的 [Quorum 定义](https://etcd.io/docs/v3.6/learning/glossary/#quorum)将它解释为修改集群状态、达成共识所需的活跃成员数量，并明确 etcd 要求成员多数派。因此，在这个语境里，说「达到 quorum」意味着满足多数派要求。

ZooKeeper 的[设计说明](https://zookeeper.apache.org/doc/current/zookeeperOver.html#sc_designGoals)同样指出，多数服务器可用时服务可以继续工作；[Observer 说明](https://zookeeper.apache.org/doc/current/zookeeperObservers.html#sc_observers)则明确 Observer 不参与投票，不能用它补足投票人数。默认等权多数派下，5 个投票节点需要 3 个，Leader 自身计入，Observer 不计入；剩余 3 个投票节点能正常通信并完成恢复时，可以容忍另外 2 个故障。这里的数字是按过半数规则计算，不适用于所有自定义 quorum 配置。

## Sentinel 的故障判定与切换授权分开计数

Redis [Sentinel 的 Quorum 章节](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/#quorum)区分两道门槛：

1. **确认客观下线**：认为主节点不可达的哨兵数量达到配置的 `quorum`。
2. **授权执行切换**：负责切换的哨兵还要得到多数哨兵授权；如果配置的 `quorum` 更大，授权数量还须达到该值，即至少为 `max(quorum, ⌊N/2⌋ + 1)`，`N` 是参与该主节点监控选举的已知哨兵总数。

原文用 **5 个哨兵、quorum 为 2** 举例：2 个同意就能确认故障，但切换授权至少需要 3 个。如果只剩 2 个哨兵能互相通信，即使能确认故障，也无法取得多数授权。若 quorum 配为 5，则确认故障和授权切换都需要 5 个。

2026-10-19 核对上述文档，未执行网络分区或故障切换实验。
