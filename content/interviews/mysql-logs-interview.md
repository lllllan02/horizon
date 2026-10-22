---
title: "MySQL 的三个日志分别有什么用途？"
category: "MySQL"
parent: mysql-interview-index
tags: ["面试", "MySQL", "事务"]
learning_status: organized
created_at: "2026-10-22 10:46:04"
updated_at: "2026-10-22 11:00:19"
learning_status_changed_at: "2026-10-22 11:09:59.603"
---

MySQL 三个重要的日志分别是 binlog、redo log 和 undo log。其中，binlog 属于 MySQL Server 层，redo log 和 undo log 属于 InnoDB 引擎层。

[[mysql-logs-sources#binlog：复制与时间点恢复|binlog（二进制日志）]]记录数据库的数据和结构变更事件，主要用于「**主从复制和时间点恢复**」。从库通过重放这些事件同步数据；恢复数据时，可以先恢复备份，再重放备份之后的 binlog，把数据恢复到目标时间点。

[[mysql-logs-sources#redo log：崩溃后的重做|redo log（重做日志）]]记录重做数据修改所需的信息，主要用于「**崩溃恢复**」。如果宕机时修改过的数据页还没写入数据文件，重启后就可以依据已经持久化的 redo log 重做修改。

[[mysql-logs-sources#undo log：回滚与旧版本读取|undo log（回滚日志）]]记录撤销修改所需的信息，用于「**事务回滚**」，同时也支持 [[mysql-mvcc-interview|MVCC]]。事务需要回滚时，会依据 undo log 撤销修改；快照读需要旧版本时，会根据回滚指针沿版本链，利用 undo log 重建对当前事务可见的历史数据。
