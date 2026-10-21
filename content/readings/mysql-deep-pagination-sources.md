---
title: "MySQL 深分页优化资料导读"
category: "MySQL"
tags: ["SQL优化", "分页"]
type: article
learning_status: pending
created_at: "2026-10-21T10:51:59+08:00"
updated_at: "2026-10-21T10:51:59+08:00"
source:
  - "https://planetscale.com/learn/courses/mysql-for-developers/examples/deferred-joins"
  - "https://planetscale.com/learn/courses/mysql-for-developers/examples/cursor-pagination"
  - "https://dev.mysql.com/doc/refman/8.4/en/limit-optimization.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html"
---

PlanetScale 的 MySQL 课程分别用延迟关联和游标分页减少分页工作量：「**延迟关联减少被丢弃记录的完整行读取，游标分页改为从已知排序边界继续读取**」。本篇节选两节课程，并用 MySQL 8.4 官方手册核对索引内容与排序边界；未运行数据库性能实验。

## 游标分页：从边界继续

[Cursor pagination](https://planetscale.com/learn/courses/mysql-for-developers/examples/cursor-pagination)记录上一页最后一条结果的排序值，下一次查询用这个边界取后续记录，避免每页重新跳过之前的结果。这里的游标是应用保存的排序键，不是数据库游标对象。

课程强调排序必须唯一：按非唯一字段排序时，要同时记录、比较主键等唯一字段，否则会漏掉与边界值相同的记录。MySQL 的 [LIMIT 优化文档](https://dev.mysql.com/doc/refman/8.4/en/limit-optimization.html)也说明，相同排序值之间的结果顺序不确定，增加唯一字段可使顺序确定。

这种方式需要已知边界，并有匹配过滤、范围与排序的索引，适合连续翻页，不能直接把页码换成键值。唯一排序也不等于跨页快照：并发修改排序键仍可能使记录跨越边界。

## 延迟关联：先分页再取完整行

[Deferred joins](https://planetscale.com/learn/courses/mysql-for-developers/examples/deferred-joins)先展示查询完整行、跳过大量结果的成本，再将分页移到只查主键的子查询，外层按主键关联原表。课程示例按 `birthday, id` 排序，跳过 450000 条取 20 条；为 `birthday` 建索引后，内层可以覆盖访问，完整字段留到这 20 条确定后再读取。

MySQL 的 [InnoDB 索引文档](https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html)说明，二级索引包含索引列与主键，取得非覆盖字段时要用主键查聚簇索引。这解释了延迟关联的收益：原查询若沿二级索引扫描并提前取非覆盖字段，改写可减少被丢弃记录的取行工作；原查询已经覆盖时，额外关联未必有收益。

「**内层保留 OFFSET，因此并未消除偏移扫描**」。课程的外层查询也明确写出排序，不能依赖关联自动保留内层顺序。实际收益仍需结合执行计划、过滤条件与索引验证，不将课程环境的耗时作为通用承诺。
