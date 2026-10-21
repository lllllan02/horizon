---
title: "为什么 MySQL InnoDB 使用 MVCC 实现事务隔离？"
aliases: ["为什么使用 MVCC", "MySQL MVCC 面试题"]
category: "MySQL"
parent: mysql-interview-index
tags: ["面试", "MySQL", "事务"]
learning_status: organized
created_at: "2026-10-20 21:14:30"
updated_at: "2026-10-20 21:17:10"
learning_status_changed_at: "2026-10-20 21:17:55.048"
---

[[database-isolation-sources#多版本读取与锁的分工|MVCC]] 的主要目的，是在满足[[database-isolation-interview|事务隔离要求]]的同时，减少读写之间的阻塞。

它让普通的快照读按快照规则读取可见的数据版本，写操作仍可以修改当前数据，因此读写可以并发进行。读已提交和可重复读采用不同的快照规则，控制能看到哪些修改；写操作和锁定读仍然需要锁来协调。
