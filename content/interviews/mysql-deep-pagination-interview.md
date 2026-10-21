---
title: "MySQL 深分页怎么优化？"
aliases: ["MySQL 深分页", "深分页优化"]
category: "MySQL"
parent: mysql-interview-index
tags: ["面试", "MySQL", "SQL优化", "分页"]
learning_status: organized
created_at: "2026-10-21 10:51:59"
updated_at: "2026-10-21 10:51:59"
learning_status_changed_at: "2026-10-21 11:04:41.934"
---

深分页就是 `LIMIT offset, size` 中偏移量很大。即使索引能提供排序，也要扫描并跳过前面的记录；如果还需要回表取完整行，开销会更大。常见优化可以重点回答两种。

- [[mysql-deep-pagination-sources#游标分页：从边界继续|游标分页（Keyset Pagination）]]：保存上一页最后一条记录的排序键，下一页从这个位置继续查。比如按唯一的 `id` 升序排列，就用 `WHERE id > last_id ORDER BY id LIMIT 20`。配合匹配的索引，可以「**避免大偏移扫描**」。它适合连续翻页，不方便直接跳到任意页码；排序字段不唯一时，要加主键等唯一字段，保证排序确定。
- [[mysql-deep-pagination-sources#延迟关联：先分页再取完整行|延迟关联（Deferred Join）]]：先在子查询中通过[[mysql-covering-index-interview|覆盖索引]]查出当前页的主键，再关联原表补齐其他字段。这样只为当前页取完整行，减少被跳过记录的回表开销。它能保留[[mysql-filter-pagination-interview|按页码跳转]]，但「**仍然需要扫描偏移部分**」，所以页数很深时依然会变慢；原查询已经覆盖时，收益可能有限。
