---
title: "MySQL 三类日志官方资料导读"
category: "MySQL"
tags: ["MySQL", "事务"]
type: article
learning_status: pending
created_at: "2026-10-22 10:46:04"
updated_at: "2026-10-22 10:46:04"
source:
  - "https://dev.mysql.com/doc/refman/8.4/en/binary-log.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-redo-log.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-undo-logs.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-recovery.html"
---

MySQL 8.4 官方手册区分了两类恢复：恢复备份后重放 binlog，以及异常退出后由 InnoDB 自动执行的崩溃恢复。前者把备份推进到目标时间点；后者包含 redo 重做与未完成事务的回滚。以下节选三类日志的用途和恢复边界，未运行数据库实验。

## binlog：复制与时间点恢复

[The Binary Log](https://dev.mysql.com/doc/refman/8.4/en/binary-log.html)说明，二进制日志以事件记录建表、表数据修改等数据库变更。它是 Server 层提供的日志，手册明确列出两个主要用途：复制源把事件发送给副本，副本重现相同的数据变化；恢复备份后，重新执行备份之后记录的事件，补齐后续变更。binlog 不是所有 SQL 的执行流水，普通 SELECT 等不修改数据的语句不在其记录范围内。

[InnoDB Recovery 的 Point-in-Time Recovery](https://dev.mysql.com/doc/refman/8.4/en/innodb-recovery.html)进一步说明，时间点恢复需要可用的基础备份及其后的二进制日志。这里的「恢复」是从备份继续重放变更，不能据此把 binlog 概括成 InnoDB 用于重做数据页的日志。已有[[data-sync-sources#CDC 与日志订阅|数据同步资料]]说明了如何通过订阅这些变更构建增量同步。

## redo log：崩溃后的重做

[Redo Log](https://dev.mysql.com/doc/refman/8.4/en/innodb-redo-log.html)将 redo log 定义为用于崩溃恢复的磁盘数据结构。正常运行时，它编码数据修改所需的重做信息；异常关闭前尚未完成写入数据文件的修改，会在初始化、接受连接之前自动重放。因此，数据页尚未落盘时，已持久化的重做信息能用于补回这些修改。

[InnoDB Crash Recovery](https://dev.mysql.com/doc/refman/8.4/en/innodb-recovery.html)把 redo 应用和未完成事务回滚列为不同步骤。「**redo 重做不等于把所有修改都当作已提交**」：对普通事务，重做之后仍需撤销未提交事务的影响；已进入 XA PREPARE 的事务有单独的处理边界。

## undo log：回滚与旧版本读取

[Undo Logs](https://dev.mysql.com/doc/refman/8.4/en/innodb-undo-logs.html)说明，undo log 是与读写事务关联的一组撤销记录，保存撤销该事务对聚簇索引记录最新修改所需的信息。事务回滚据此撤销修改；其他事务的一致性读需要旧数据时，也能从 undo 记录重建相应版本。

因此，undo 同时服务于「**回滚与多版本读取**」，不是事务提交后就一律删除。旧版本如何支撑快照、何时仍需保留 update undo，由[[database-isolation-sources#多版本读取与锁的分工|多版本读取与锁的分工]]承接。
