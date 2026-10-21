---
title: "连接池状态指标"
category: "Go"
tags: ["Go", "连接池", "性能排查"]
learning_status: pending
created_at: "2026-10-18 23:53:19"
updated_at: "2026-10-18 23:53:19"
---

连接池状态指标反映池内的连接数量、等待情况和连接回收情况，用于观察连接资源的占用。以 Go `database/sql` 为例，调用 `db.Stats()` 可取得以下[[go-sql-connections#状态和累计计数分别说明什么|DBStats 指标]]，统计范围是对应的单个连接池。

| 指标 | 字段 | 含义 |
| --- | --- | --- |
| 最大连接数 | `MaxOpenConnections` | 配置的打开连接数上限，0 表示不限制 |
| 当前打开连接数 | `OpenConnections` | 使用中与空闲连接的总数 |
| 使用中连接数 | `InUse` | 当前被占用、尚未归还的连接数 |
| 空闲连接数 | `Idle` | 当前可供复用的连接数 |
| 累计等待次数 | `WaitCount` | 获取连接时发生等待的累计次数 |
| 累计等待时间 | `WaitDuration` | 等待连接的累计阻塞时间 |
| 因空闲数量限制关闭的连接数 | `MaxIdleClosed` | 因超过允许保留的空闲连接数而关闭的累计连接数 |
| 因空闲超时关闭的连接数 | `MaxIdleTimeClosed` | 因空闲时长达到限制而关闭的累计连接数 |
| 因寿命限制关闭的连接数 | `MaxLifetimeClosed` | 因连接存活时长达到限制而关闭的累计连接数 |

累计指标应比较同一连接池两次采样的增量；`WaitCount` 是历史累计次数，不是当前排队数。
