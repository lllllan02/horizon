---
title: "怎么看 MySQL 的 EXPLAIN？"
category: "MySQL"
parent: mysql-interview-index
tags: ["面试", "MySQL", "性能排查"]
learning_status: organized
created_at: "2026-10-19T19:19:47+08:00"
updated_at: "2026-10-19T19:19:47+08:00"
learning_status_changed_at: "2026-10-21T10:11:19.586+08:00"
---

[[mysql-slow-query-sources#执行计划要看工作量|EXPLAIN]] 展示优化器预计怎样执行 SQL。看传统表格输出时，先通过 `table` 确认对应的表，再重点看四个方面：

- **「访问方式」**：看 `type`，比如 `ref` 是索引等值查找，`range` 是范围扫描，`index` 是全索引扫描，`ALL` 是全表扫描。
- **「索引使用」**：`possible_keys` 是候选索引，`key` 是实际选择的索引；结合 `key_len` 和索引定义，判断用到了哪些前缀列。
- **「扫描与过滤」**：`rows` 是预计扫描行数，`filtered` 是过滤后预计保留的百分比，结合起来看需要处理多少数据。
- **「额外信息」**：看 `Extra`，`Using index` 表示覆盖索引，`Using filesort` 表示额外排序，`Using temporary` 表示使用内部临时表。

要**「结合扫描量判断，不能只看有没有走索引」**。普通 EXPLAIN 的信息主要是估算；需要实际耗时和行数时，可以用会真正执行 SQL 的 `EXPLAIN ANALYZE`。
