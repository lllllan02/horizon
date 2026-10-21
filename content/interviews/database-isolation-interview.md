---
title: "数据库有哪些事务隔离级别，分别解决什么问题？"
aliases: ["数据库隔离级别面试题", "Transaction Isolation Levels"]
category: "MySQL"
parent: mysql-interview-index
tags: ["面试", "MySQL", "事务"]
learning_status: organized
created_at: "2026-10-19T22:40:16+08:00"
updated_at: "2026-10-21T10:18:34+08:00"
learning_status_changed_at: "2026-10-21T10:19:57.267+08:00"
---

事务隔离级别规定并发事务之间能看到哪些修改，用来权衡一致性保证与并发成本。

按 [[database-isolation-sources#四级隔离与三种读异常|SQL 标准的最低保证]]，从低到高依次为：

1. 「**读未提交（Read Uncommitted）**」：允许读取其他事务尚未提交的修改，即脏读；也可能出现不可重复读和幻读。
2. 「**读已提交（Read Committed）**」：消除脏读，但仍可能出现不可重复读，即同一事务重复读取某行时，读到其他事务已提交的新值；也允许幻读。
3. 「**可重复读（Repeatable Read）**」：进一步消除不可重复读，但仍允许幻读，即同一事务按相同条件重复查询时，匹配的行集合因其他事务提交而变化。
4. 「**串行化（Serializable）**」：保证成功提交的事务整体效果等价于某种串行执行顺序，消除上述三种读异常。实际仍可并发执行，但可能增加等待或失败重试的成本。
