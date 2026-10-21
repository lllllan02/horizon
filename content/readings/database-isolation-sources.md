---
title: "事务隔离级别官方资料导读"
category: "MySQL"
tags: ["MySQL", "事务"]
type: article
learning_status: pending
created_at: "2026-10-19T22:40:16+08:00"
updated_at: "2026-10-20T21:14:30+08:00"
source:
  - "https://www.postgresql.org/docs/17/transaction-iso.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-next-key-locking.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-multi-versioning.html"
---

**「隔离级别描述保证，快照与锁描述实现。」** PostgreSQL 17 手册以读异常解释 SQL 标准的最低保证；MySQL 8.4 手册进一步说明 InnoDB 如何用多版本读取和范围加锁落实隔离。以下仅节选四级隔离、读异常、多版本读取与锁的分工及相关实现边界，相关章节核对于 2026-10-19 至 2026-10-20，未运行数据库实验。

## 四级隔离与三种读异常

PostgreSQL 的 [Transaction Isolation 定义段与表 13.1](https://www.postgresql.org/docs/17/transaction-iso.html)区分三种读异常：脏读（Dirty Read）是读取其他未提交事务写入的数据；不可重复读（Nonrepeatable Read）是同一事务重新读取此前读过的数据，发现另一事务已提交的修改；幻读（Phantom Read）是同一事务重新执行相同条件的查询，发现匹配的行集合因另一事务提交而变化。回滚用于说明脏读的风险，不是定义条件；幻读也不要求记录数一定增加。

按手册转述的标准最低保证，读未提交允许这三种异常；读已提交禁止脏读；可重复读再禁止不可重复读；串行化禁止三种异常，并保证提交结果等价于某种串行执行顺序。**「没有这三种读异常，不足以推出已经可串行化。」** 手册将串行化异常另列一项，指出 PostgreSQL 可重复读虽禁止幻读，仍可能出现串行化异常。这里的标准说明来自官方手册，未直接核对 SQL 标准原文。

## 多版本读取与锁的分工

[InnoDB Multi-Versioning](https://dev.mysql.com/doc/refman/8.4/en/innodb-multi-versioning.html)说明，InnoDB 保存被修改行的旧版本信息，既支持事务回滚，也用于构造一致性读所需的旧行。它通过 undo 信息重建历史版本，无需在每次建立快照时复制整张表。

[Consistent Nonlocking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html)说明，一致性读按快照读取可见版本，不给访问的数据设置用于阻止其他会话修改的锁，因此读取期间其他会话仍能修改数据。结合这两处机制，可以将采用 MVCC 的设计收益归纳为：**「让普通读取在满足可见性要求时，减少与写入互相等待。」** 这是对手册机制的归纳；锁也能协调并发访问，隔离要求本身并不限定只能采用多版本。

多版本也有成本：旧版本需要保存、重建和清理；仍有快照需要旧版本时，相应的 update undo 不能丢弃。它主要用于读已提交、可重复读下的普通一致性读；锁定读与写入仍依靠锁，不能据此推出所有隔离级别、所有 SQL 都不需要加锁。

## InnoDB 的快照读

MySQL 的 [Consistent Nonlocking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html)说明，一致性读通过多版本数据呈现某一时点的快照，不看到该时点之后提交或尚未提交的其他事务修改；自身此前语句的修改仍然可见。

在默认的可重复读级别，同一事务的一致性读复用第一次此类读取建立的快照；读已提交则每次建立新快照。手册的双会话例子中，A 先查空表，B 插入并提交，A 再查仍为空；A 结束事务后再读，才能看到 B 的插入。这解释了为什么固定快照也能稳定范围查询的结果，而不只是某一行的字段值。

**「快照约束不能直接推广到更新操作。」** 手册另举例：某事务的快照查询没有匹配行，但 UPDATE 仍可能修改其他事务后来提交的行；修改后，自身写入对后续查询可见。因此「事务内所有 SQL 永远看到同一份结果」超过了该保证。

## InnoDB 的范围锁定读

[Transaction Isolation Levels 的 RR 小节](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)说明，锁定读、UPDATE、DELETE 的加锁取决于访问条件：唯一索引上的唯一条件命中已有记录时可以只锁记录；其他搜索会使用间隙锁或临键锁保护扫描的索引范围。锁定操作使用较新的数据库状态，与旧快照读混用时，不能假定两者共享同一视图。

[Phantom Rows](https://dev.mysql.com/doc/refman/8.4/en/innodb-next-key-locking.html)用 `id > 100 FOR UPDATE` 说明为什么只锁已有记录还不够：索引原有 90、102，其他事务仍可能向二者之间插入 101。临键锁（Next-Key Lock）把索引记录锁和该记录前方的间隙锁组合起来，阻止插入；还需保护最后一条记录之后的相关间隙。**「范围保护包括尚不存在的记录位置」**，这是避免此类幻读的关键。

## 串行化的执行与代价

[PostgreSQL 17 的 Serializable 小节](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-SERIALIZABLE)说明，可串行化仍允许并发执行，通过监控读写依赖拒绝无法满足保证的事务，应用可能需要重试整笔事务。它保证的是提交效果，不要求物理执行时一次只运行一个事务。

[MySQL 8.4 的 Serializable 小节](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)给出另一种实现边界：关闭 autocommit 时，普通 SELECT 会隐式转为 FOR SHARE；开启 autocommit 时，独立的只读 SELECT 可以使用非锁定一致性读。因此隔离级别名称不能直接代替对锁、等待和重试行为的判断。
