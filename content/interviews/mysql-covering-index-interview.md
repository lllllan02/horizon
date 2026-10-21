---
title: "什么是覆盖索引？"
aliases: ["MySQL 覆盖索引", "Covering Index"]
category: "MySQL"
parent: mysql-interview-index
tags: ["面试", "MySQL", "性能排查"]
learning_status: organized
created_at: "2026-10-21T10:20:48+08:00"
updated_at: "2026-10-21T10:23:35+08:00"
learning_status_changed_at: "2026-10-21T10:26:30.677+08:00"
---

InnoDB 中可以区分[[mysql-index-structure-sources#叶节点保存什么|聚簇索引和二级索引]]，二级索引也称非聚簇索引。聚簇索引的叶节点保存完整的行记录，二级索引的叶节点保存「**索引列和主键值**」。

如果查询走二级索引，但 `SELECT *` 或其他查询字段超出了索引包含的内容，就需要根据主键再到聚簇索引取数据，这一步叫「**回表**」，会增加额外的数据访问开销。

优化时，如果让二级索引包含查询所需的全部字段，通常就能直接从索引取得结果，避免为获取字段而回表，这就形成了「**[[mysql-slow-query-sources#索引要匹配查询与成本|覆盖索引]]**」。是否覆盖，要结合具体查询判断。
