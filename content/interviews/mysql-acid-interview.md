---
title: "讲一下 MySQL 事务的 ACID 特性？"
aliases: ["事务 ACID 面试题", "ACID 四大特性"]
category: "MySQL"
parent: mysql-interview-index
tags: ["面试", "MySQL", "事务"]
learning_status: organized
created_at: "2026-10-22 10:43:14"
updated_at: "2026-10-22 10:55:39"
learning_status_changed_at: "2026-10-22 11:01:32.917"
---

事务把一组数据库操作作为一个整体处理，具有 [[mysql-acid-sources|ACID]] 四个特性：

- 「**原子性（Atomicity）**」：事务中的操作要么全部成功，要么全部回滚。
- 「**一致性（Consistency）**」：事务执行前后，数据都应满足既定约束和业务规则。
- 「**隔离性（Isolation）**」：控制并发事务之间的相互影响，具体保证由[[database-isolation-interview|隔离级别]]决定。
- 「**持久性（Durability）**」：事务提交成功后，修改会被持久保存，数据库崩溃恢复后仍然有效。

记忆线索：「**原、一、隔、持**」——做全、守规则、管并发、存得住。
