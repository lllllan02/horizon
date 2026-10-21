---
title: "MySQL 慢查询一般怎么优化？"
category: "MySQL"
parent: mysql-interview-index
tags: ["面试", "MySQL", "性能排查"]
learning_status: organized
created_at: "2026-10-19 17:36:41"
updated_at: "2026-10-19 17:39:39"
learning_status_changed_at: "2026-10-19 19:19:23.674"
---

先通过[[mysql-slow-query-sources#慢查询日志负责定位候选|慢查询日志]]定位具体 SQL，再用[[mysql-explain-interview|EXPLAIN]] 看索引使用、扫描行数和排序等开销。

根据原因优化：

- **「没有合适的索引」**：结合查询条件建立索引，权衡查询收益和写入成本。
- **「有索引但没用上」**：检查查询写法和索引是否匹配，也可能是优化器认为全表扫描更划算。
- **「用了索引仍然慢」**：减少扫描、回表和排序开销，比如减少查询字段、使用[[mysql-slow-query-sources#索引要匹配查询与成本|覆盖索引]]。

如果是锁等待等原因，再结合事务和监控排查。最后**「验证优化效果」**，对比耗时、扫描量，并确认结果正确。
