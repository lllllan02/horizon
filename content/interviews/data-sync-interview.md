---
title: "如何设计一个数据同步方案"
category: "数据处理"
parent: data-sync-interview-index
tags: ["面试", "数据同步"]
learning_status: organized
created_at: "2026-10-20 11:09:10"
updated_at: "2026-10-21 18:53:30"
learning_status_changed_at: "2026-10-21 18:58:20.356"
---

以 MySQL 数据同步为例，先基于[[data-sync-initialization-interview|一致快照]]做全量初始化，协调记录配套的 Binlog 位点，再通过[[data-sync-sources#CDC 与日志订阅|CDC（变更数据捕获）]]持续读取后续变更，写入目标库。

**一致性要求较高时**，将数据写入与[[data-sync-sources#恢复与目标写入|同步进度保存]]放在同一目标库事务中，一起提交、一起回滚；通过至少一次投递和失败重试避免丢失，通过幂等处理避免重复生效，并保证同一数据按序应用。

**允许最终一致时**，可以不要求整批回滚，但仍需保存同步进度、重试失败并处理重复写入，同时定期[[data-sync-sources#落地示例与数据校验|校验数据]]，排除正常同步延迟后，少量偏差定向补写、修正或删除，大范围偏差全量重建，再从新快照配套的位点继续增量。
