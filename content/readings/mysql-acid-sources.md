---
title: "MySQL 事务 ACID 官方资料导读"
category: "MySQL"
tags: ["MySQL", "事务"]
type: article
learning_status: pending
created_at: "2026-10-22 10:43:14"
updated_at: "2026-10-22 10:43:14"
source:
  - "https://dev.mysql.com/doc/refman/8.4/en/mysql-acid.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/glossary.html#glos_acid"
  - "https://dev.mysql.com/doc/refman/8.4/en/glossary.html#glos_constraint"
  - "https://dev.mysql.com/doc/refman/8.4/en/glossary.html#glos_isolation_level"
---

MySQL 8.4 手册用 ACID 描述可靠事务的四类保证：**原子性、一致性、隔离性、持久性**。InnoDB 提供相关事务机制，隔离保证随隔离级别变化，持久性还涉及刷盘配置和硬件条件。本篇节选定义与必要边界，核对于 2026-10-22，未运行数据库实验。

[ACID 术语条目](https://dev.mysql.com/doc/refman/8.4/en/glossary.html#glos_acid)将多次修改视作一个整体：全部提交，或全部回滚，对应「**原子性（Atomicity）**」；提交成功后，修改具有「**持久性（Durability）**」。[InnoDB 与 ACID 模型的 Durability 部分](https://dev.mysql.com/doc/refman/8.4/en/mysql-acid.html)进一步指出，持久性涉及软件设置、操作系统和存储设备，因此不能把定义理解为任意配置与任意硬件故障下都绝不丢失。

「**一致性（Consistency）**」关注数据保持有效、满足约束的状态。[constraint 条目](https://dev.mysql.com/doc/refman/8.4/en/glossary.html#glos_constraint)说明，约束用于防止数据不一致，举例包括外键与唯一约束。由此归纳的应用边界是：数据库能执行已声明的约束，业务规则也需要应用用正确的事务逻辑落实；把错误的扣款、入账代码包进事务，并不会自动使金额守恒。这是教学归纳，扣款例子为自拟场景。

「**隔离性（Isolation）**」约束并发事务之间的相互影响。[isolation level 条目](https://dev.mysql.com/doc/refman/8.4/en/glossary.html#glos_isolation_level)说明，隔离级别可以调节并发保护程度；[ACID 模型的 Isolation 部分](https://dev.mysql.com/doc/refman/8.4/en/mysql-acid.html)关联事务隔离级别与锁机制。各级别的可见性与读异常由[[database-isolation-sources|事务隔离级别资料]]展开，不能将隔离性概括成所有事务完全互不影响。
