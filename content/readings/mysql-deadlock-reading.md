---
title: "MySQL 死锁排查资料导读"
category: "MySQL"
tags: ["MySQL", "死锁", "事务", "性能排查"]
type: article
learning_status: pending
created_at: "2026-10-18 11:52:26"
updated_at: "2026-10-18 20:45:54"
source:
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlock-example.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html"
  - "https://www.percona.com/blog/how-to-deal-with-mysql-deadlocks/"
  - "https://www.percona.com/blog/deadlock-troubleshooting-in-percona-server-for-mysql-5-7/"
---

MySQL 官方手册解释等待环、回滚边界与减少冲突的方法；Percona 的原创排障文章补充了实际难点：死锁报告通常只呈现当时执行的语句，取得锁的较早语句需要另找。以下节选与排查、修复直接相关的部分，以 MySQL 8.4 InnoDB 为准；两篇 Percona 文章分别发表于 2014、2020 年，旧版本工具不能直接视为当前版本方案。

## 官方示例：怎样从报告还原等待环

[双会话示例](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/innodb-deadlock-example.html)创建 Animals、Birds 两张表，各放一条主键记录，随后交错执行：

| 顺序 | 会话 A | 会话 B |
| --- | --- | --- |
| 1 | 开启事务，用 `FOR SHARE` 读 Animals 的 Aardvark | — |
| 2 | — | 开启事务，用 `FOR SHARE` 读 Birds 的 Buzzard |
| 3 | — | 更新 Animals 的 Aardvark，需要 X 锁，被 A 的 S 锁阻塞 |
| 4 | 更新 Birds 的 Buzzard，需要 X 锁，被 B 的 S 锁阻塞 | — |

S 是共享锁，X 是排他锁；同一记录上其他事务持有 S 或 X 时，X 请求需要等待。第四步构成 A 等 B、B 等 A 的环，示例返回 `1213 (40001)`，并在报告中标出被回滚的事务。回滚释放锁后，另一个更新可以继续。

报告可把每个事务的 `HOLDS THE LOCK(S)` 与 `WAITING FOR THIS LOCK TO BE GRANTED` 对照到表、索引、记录和锁模式；`WE ROLL BACK TRANSACTION` 表示处理结果。示例同时给出 `data_locks`、`data_lock_waits` 查询，以及 `INNODB_METRICS` 中 `lock_deadlocks` 的计数入口。本文复述手册示例，未在本地运行。

## 官方规则：失败后还剩下什么

[MySQL 8.4 错误码参考](https://dev.mysql.com/doc/mysql-errors/8.4/en/server-error-reference.html)将 `1213 / ER_LOCK_DEADLOCK` 用于死锁，将 `1205 / ER_LOCK_WAIT_TIMEOUT` 用于锁等待超时。等待过久不证明等待关系中存在环；排查前应先核对错误类型。

[错误信息接口](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/error-interfaces.html)说明，服务端可向客户端返回错误，客户端程序能取得错误码、SQLSTATE 和消息；程序判断应使用错误码或符号，不依赖消息文本。客户端可将这些信息记录到应用日志，命令行客户端则直接显示 SQL 执行报错。服务端错误日志与发给客户端的错误消息是不同出口，不能假定每个 SQL 报错都会自动写入 mysqld 错误日志。`SHOW ENGINE INNODB STATUS` 保存的最近一次死锁报告用于追查现场，不是当前请求的错误返回；应先从本次报错确定入口，再核对报告时间与事务信息。

[InnoDB 错误处理](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html)区分两个边界：死锁回滚整个被选中的事务，重新执行必须从事务开始；锁等待超时默认只回滚超时语句，启用 `innodb_rollback_on_timeout` 才改为整体回滚。语句回滚不能当作全部事务锁已经释放。

[死锁检测](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlock-detection.html)说明，检测默认开启，InnoDB 倾向选择较小的事务回滚，大小按插入、更新、删除的行数衡量；不能预设总是回滚后到的事务。极高并发下大量线程等同一锁时，检测可能成为负担；关闭检测是依赖等待超时恢复的取舍，需要评估性能与失败处理，不能消除资源竞争。

[INNODB_TRX 的 TRX_WEIGHT 说明](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/information-schema-innodb-trx-table.html)进一步指出，事务权重反映修改行数和锁定行数，但不一定等于它们的精确计数；死锁时选择权重较小的事务作为回滚对象。因此，不能只数 SQL 条数，也不能仅按事务开始时间预测结果。修改过非事务表的事务有更高权重；将其归纳为「倾向回滚代价较小的一方」便于理解，但不能据此承诺每次固定回滚某个业务事务。

## 锁等待超时的时限与定位

[innodb_lock_wait_timeout](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/innodb-parameters.html#sysvar_innodb_lock_wait_timeout)控制 InnoDB 行锁等待时限，默认 50 秒，可按全局或会话配置。应检查发生问题的业务会话；调整全局值影响后续新连接，不会直接改写已有连接的会话值。这个参数约束等锁时间，不是整个 SQL 或事务的总耗时上限。

该参数不适用于所有锁：元数据锁的等待由 [lock_wait_timeout](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/server-system-variables.html#sysvar_lock_wait_timeout)控制，也可能返回 ER_LOCK_WAIT_TIMEOUT。因此，1205 不能单独确定锁类型。默认开启死锁检测时，检测到等待环会选择事务回滚，无须等满行锁超时；关闭检测后，死锁也可能以等待超时结束，不能用 1205 排除等待环。

[官方事务与锁示例](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/innodb-information-schema-examples.html)通过多个会话等待同一事务，展示 `sys.innodb_lock_waits` 的等待者、阻塞者与 SQL。阻塞者本身也可能被阻塞，要继续沿关系追查；连接空闲时 `blocking_query` 可为 NULL，需要结合事务状态、应用日志和已有语句历史确认持锁来源。等待已解除或超时后，当前视图未必还能保留当时关系。

## 官方诊断接口：历史报告与当前等待分工不同

[减少与处理死锁](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html)建议先看 `SHOW ENGINE INNODB STATUS` 的最近一次死锁；要保留每次报告，可在排查期间开启 `innodb_print_all_deadlocks`，写入错误日志，结束后关闭。该文同时建议短事务、及时提交、统一操作顺序、合适索引和减少不必要的锁定读；最后才考虑牺牲并发的串行执行。

[sys.innodb_lock_waits](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/sys-innodb-lock-waits.html)直接给出等待连接、阻塞连接、SQL、表、索引和等待时长。阻塞连接空闲时 `blocking_query` 可以为 NULL，不能由此判断没有持锁事务。

[INNODB_TRX](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/information-schema-innodb-trx-table.html)补充当前事务的状态、开始时间、MySQL 连接 ID、隔离级别及锁定／修改行数；读取该表需要 PROCESS 权限。[schema_table_lock_waits](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/sys-schema-table-lock-waits.html)则针对元数据锁，不能与数据锁类型混用。[INNODB_METRICS](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/information-schema-innodb-metrics-table.html)的计数器可以启停和重置，比较增量前需确认采样期间持续启用且没有重置。

[data_lock_waits](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/performance-schema-data-lock-waits-table.html)保存请求锁与阻塞锁的多对多关系，可分别用请求／阻塞锁 ID 和 ENGINE 关联 [data_locks](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/performance-schema-data-locks-table.html)。后者补充锁模式、授予／等待状态和记录值；二级索引的 `LOCK_DATA` 包含索引值及附加主键，也可能为 NULL。这些接口描述当前锁状态，不能替代已经解除的死锁报告。

[MySQL 8.0 锁表说明](https://docs.oracle.com/cd/E17952_01/mysql-8.0-en/performance-schema-lock-tables.html)也列出 Performance Schema 的上述表。排查旧版本时须按对应手册选择接口，不能直接混用旧文章的查询。

## 为什么 SQL 看似只改一行，仍需检查索引与约束

[语句加锁规则](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/innodb-locks-set.html)说明，锁定读、UPDATE、DELETE 的锁与扫描的索引记录有关，二级索引的排他访问还会锁对应聚簇记录；外键检查、重复键检查也会取得锁。文章给出普通 INSERT 在重复键竞争中发生死锁的例子，说明单条插入也可能涉及多阶段加锁。

[锁类型](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/innodb-locking.html)进一步区分：记录锁保护索引记录；间隙锁阻止向间隙插入；临键锁组合记录及其前方间隙。纯间隙锁之间可以共存，不能把间隙上的 S、X 字样直接按记录锁冲突矩阵解释。报告中 `locks rec but not gap` 表示只锁记录，`locks gap before rec` 指向间隙，`insert intention waiting` 表示插入意向在等待；表上的 IX 则是意向排他锁，不等于整表被独占。

[隔离级别](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/innodb-transaction-isolation-levels.html)说明，RR 的唯一条件命中唯一索引记录可只锁记录，其他范围搜索可能使用间隙／临键锁；RC 的搜索与扫描通常不使用间隙锁，仍保留外键和重复键检查的例外，也仍可能死锁。RC 的每次一致性读使用新快照，评估切换时必须一起考虑读取语义。

## Percona：报告不足时，怎样补全事务历史

Peiran Song 的 [How to deal with MySQL deadlocks（2014）](https://www.percona.com/blog/how-to-deal-with-mysql-deadlocks/)逐项解释日志中的时间、事务 ID、连接 ID、锁对象与 Undo 条目。其中一个案例当时显示的是向 t1 插入，却在等待 t2 的共享记录锁；作者通过表结构核对外键，说明不能只看当前 SQL 的表名。

文章建议用应用日志、语句历史及已有日志补齐前序语句，再与代码相互核对。Binlog 只包含已提交的事务，不能找回被回滚事务的完整历史；文中基于 statement 格式的线程定位、Percona 特有慢日志字段都有版本与格式条件。本文采用其补证思路，不照搬旧版命令和配置。

Carlos Tutte 的 [Deadlock Troubleshooting in Percona Server for MySQL 5.7（2020）](https://www.percona.com/blog/deadlock-troubleshooting-in-percona-server-for-mysql-5-7/)用交错 INSERT 重现死锁，再从 Performance Schema 提取 BEGIN 与较早的 INSERT，补上报告中缺失的操作顺序。作者明确限定：脚本只适用于 Percona Server 5.7，是概念验证；开启语句采集有开销，多事务参与时也可能只能提供部分信息。

当前 [events_statements_history 手册](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/performance-schema-events-statements-history-table.html)还说明历史只保留每线程最近 N 条已结束语句，旧记录会被覆盖，线程结束后记录删除。因此不能把「查询为空」理解成「事务没有执行过前序 SQL」，连接复用时也须核对事务边界。

## 应急操作的语义

[KILL 手册](https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/kill.html)区分 `KILL QUERY` 与 `KILL CONNECTION`：前者停止当前语句并保留连接，后者终止连接。KILL 设置终止标记，返回时不保证清理已经完成。判断锁是否释放仍需重新观察事务与等待，不能以命令返回作为恢复证据。
