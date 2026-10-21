---
title: "数据同步的全量初始化怎么做？"
category: "数据处理"
parent: data-sync-interview-index
tags: ["面试", "数据同步"]
learning_status: organized
created_at: "2026-10-20 13:10:54"
updated_at: "2026-10-20 14:18:08"
learning_status_changed_at: "2026-10-20 14:30:32.211"
---

以 MySQL InnoDB 为例，全量初始化就是先在可重复读事务中建立[[data-sync-sources#全量初始化与一致快照|稳定的一致快照]]，基于同一个快照把已有数据全部导出，再导入目标库。如果后续要接增量同步，还需要在建立快照时协调记录「**快照对应的 Binlog 位点**」，之后从这里衔接变更，避免漏掉导出期间的修改。

工具上，`mysqldump` 配合相应参数可以完成一致性导出和位点记录，后续增量同步再由 CDC 工具接续。

需要注意，长时间持有快照会让仍被依赖的[[data-sync-sources#长时间快照的代价|Undo 历史版本无法及时清理]]，增加空间和性能压力。所以尽量选择「**写入较少的低峰时段**」执行，导出完成后及时结束源端事务。
