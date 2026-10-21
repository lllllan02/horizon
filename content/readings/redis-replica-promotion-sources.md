---
title: "Redis 哨兵选择新主节点的规则导读"
category: "Redis"
type: article
tags: ["Redis", "Sentinel", "故障切换"]
learning_status: pending
created_at: "2026-10-19 21:11:02"
updated_at: "2026-10-19 21:11:02"
source:
  - "https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/#replica-selection-and-priority"
  - "https://github.com/redis/redis/blob/8.0/src/sentinel.c"
---

**「哨兵先排除不适合接任的从节点，再依次比较配置优先级、复制进度和 Run ID。」** 本篇节选 Redis Sentinel 官方文档与 Redis 8.0 分支源码，只解释从节点的筛选和排序，不展开领头哨兵的选举。

## 先确定哪些节点有资格

官方[副本选择规则](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/#replica-selection-and-priority)要求排除与主节点断开过久的副本，避免把明显落后的节点提升为新主节点。Redis 8.0 的 [`sentinelSelectSlave`](https://github.com/redis/redis/blob/8.0/src/sentinel.c#L4670-L4710)还会检查节点是否下线、哨兵能否连接、最近是否有正常响应，以及状态信息是否足够新。因此，能连接只是候选资格的一部分。

配置 **`replica-priority=0`** 的节点也会被排除：它可以继续作为副本，但不会被 Sentinel 选为新主节点。如果没有符合条件的从节点，本次故障转移会中止。

## 符合资格后按什么顺序比较

官方文档与源码的 [`compareSlavesForPromotion`](https://github.com/redis/redis/blob/8.0/src/sentinel.c#L4645-L4668)使用以下顺序：

1. **配置优先级**：`replica-priority` 数值越小越优先，用于表达接任偏好；设为 0 则是禁止被提升，不是最高优先级。
2. **复制进度**：优先级相同时，选择已处理复制偏移量更大的节点，即已经处理了更多主节点数据的副本。它表示候选间的相对进度，不保证拥有全部已确认写入。
3. **Run ID**：优先级和复制进度都相同时，选择 Run ID 字典序较小的节点。这只是确定选择结果的规则，不表示节点性能更好。

这些规则逐项比较，不是综合打分；通过资格检查后，复制进度只在优先级相同的候选之间决定顺序。

2026-10-19 核对上述官方文档及 Redis 8.0 分支源码，分支链接未固定到提交；未部署或实测故障切换。
