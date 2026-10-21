---
title: "SHOW ENGINE INNODB STATUS"
aliases: ["InnoDB 状态报告", "InnoDB Monitor 输出"]
category: "MySQL"
tags: ["MySQL", "性能排查", "事务"]
type: practice
learning_status: pending
created_at: "2026-10-18 12:09:26"
updated_at: "2026-10-18 12:13:17"
---

**`SHOW ENGINE INNODB STATUS` 用于查看 InnoDB 的运行状态报告**，包括事务、锁等待、最近一次死锁，以及 I/O、日志和缓冲池等信息，帮助确定排查方向。

在 mysql 客户端执行，需要 PROCESS 权限；`\G` 让结果纵向显示：

```sql
SHOW ENGINE INNODB STATUS\G
```

[[assets/mysql-innodb-status-example.txt|完整输出样例]]保留了[[innodb-monitor-reading#报告怎样同时包含历史与当前信息|官方手册样例]]的全部内容，数值不是本地实测。

## 先认这几块就够了

`TRANSACTIONS` 用于看事务和当前锁等待。附件中的这段同时包含事务状态与 SQL：

```text
---TRANSACTION 7747, ACTIVE 23 sec starting index read
mysql tables in use 1, locked 1
LOCK WAIT 2 lock struct(s), heap size 1136, 1 row lock(s)
MySQL thread id 9, OS thread handle 140286987249408, query id 51 localhost root updating
DELETE FROM t WHERE i = 1
```

这里的 `ACTIVE 23 sec` 是事务活跃时长，`LOCK WAIT` 表示正在等锁；对应 SQL 是最后一行的 DELETE。其他区块先记用途：

- `LATEST DETECTED DEADLOCK`：发生过死锁时才有，保存最近一次的事务、SQL、锁冲突和回滚结果；这份样例没有这一块。排查时先核对时间，别把旧死锁当成当前阻塞。
- `FILE I/O`、`LOG`、`BUFFER POOL AND MEMORY`：分别看文件读写、Redo 日志进度、缓冲池状态。先知道去哪里找，具体指标按问题再展开。

报告还可能有后台线程、内部同步等待、最近一次外键错误等区块。这里先建立外观印象，不必逐项记忆；字段会随版本和配置变化。
