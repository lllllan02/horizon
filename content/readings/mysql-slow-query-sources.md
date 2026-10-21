---
title: "MySQL 慢查询优化资料导读"
category: "MySQL"
tags: ["MySQL", "性能排查"]
type: article
learning_status: pending
created_at: "2026-10-19 17:36:41"
updated_at: "2026-10-19 19:19:47"
source:
  - "https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/slow-query-log.html"
  - "https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/explain-output.html"
  - "https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/explain.html"
  - "https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/mysql-indexes.html"
  - "https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/where-optimization.html"
---

MySQL 8.4 官方手册把慢查询定位、执行计划分析与索引选择分开说明：**「日志帮助找到候选，计划解释访问方式，实际工作量决定优化方向」**。本篇节选与慢查询面试题直接相关的内容，未连接数据库实测。

## 慢查询日志负责定位候选

[慢查询日志](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/slow-query-log.html)记录执行时间超过 `long_query_time`，且扫描行数至少达到 `min_examined_row_limit` 的语句。日志可以按查询汇总，帮助识别值得分析的 SQL；是否入日志还受配置影响。

手册说明，取得初始锁的时间不计入执行时间，记录在语句执行并释放锁后写入。因此，日志顺序不一定等于执行顺序，日志也不能独自解释请求全部耗时。定位后仍须核对具体参数、事务与运行时信息。

## 执行计划要看工作量

[EXPLAIN 输出说明](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/explain-output.html)中，`possible_keys` 表示候选索引，`key` 表示实际选择的索引，`type` 表示访问方式，`rows` 表示估计扫描行数，`filtered` 表示条件过滤后预计保留的百分比。InnoDB 的行数是估算值，不能直接当作实际执行结果。

`type` 的常见值中，`ref` 表示索引等值查找，`range` 表示范围扫描，`index` 表示全索引扫描，`ALL` 表示全表扫描。`key_len` 是使用的索引键长度，可结合字段类型、可空性和索引定义，判断用了哪些前缀列，不能理解为越长越好。

`key` 有值也可能只是全索引扫描；索引覆盖了需要的字段，未必能有效缩小扫描范围。`Extra` 中的 `Using index` 表示从索引取得所需字段，`Using filesort` 表示额外排序，`Using temporary` 表示使用内部临时表，应结合处理的数据量判断开销；单个标记不能证明瓶颈。

[EXPLAIN ANALYZE](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/explain.html)会实际执行语句，提供执行节点的时间、返回行数和循环次数，可用于比较估算与实际情况。节点时间包含子节点时间，存在多次循环时显示每次循环的平均时间，不能直接把所有节点时间相加。

## 索引要匹配查询与成本

[索引用途](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/mysql-indexes.html)包括按条件定位、支持关联和利用索引顺序处理排序。联合索引的最左前缀可以用于定位；字符串列与数值比较等类型转换可能阻止有效使用索引，所以要检查查询语义和字段、参数类型。

**「覆盖索引」**指索引包含查询所需字段，可以直接从索引取得结果，减少额外读取数据行。它优化的是取行成本，并不保证扫描范围小；是否值得增加索引字段，还要结合存储与写入成本评估。

手册指出，小表或需要访问大部分记录时，顺序扫描可能更划算。[WHERE 优化说明](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/where-optimization.html)进一步说明，优化器综合表大小、行数和 I/O 块大小等因素估算成本，不能用固定的扫描比例判定一定选索引或全表扫描。
