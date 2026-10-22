---
title: "MySQL InnoDB 的 MVCC 是怎么实现的？"
aliases: ["为什么使用 MVCC", "MySQL MVCC 面试题", "MVCC 实现原理", "MySQL MVCC 怎么做的"]
category: "MySQL"
parent: mysql-interview-index
tags: ["面试", "MySQL", "事务"]
learning_status: organized
created_at: "2026-10-20 21:14:30"
updated_at: "2026-10-22 10:57:53"
learning_status_changed_at: "2026-10-22 11:14:29.387"
---

[[database-isolation-sources#多版本读取与锁的分工|MVCC]] 就是多版本并发控制。它让查询读取对当前事务可见的数据版本，减少读写之间的相互阻塞，提高并发性能。

在 InnoDB 中，聚簇索引记录里保存了[[database-isolation-sources#行版本与 Read View|事务 ID 和回滚指针]]。事务 ID 记录最近插入或修改这条记录的事务是谁；回滚指针指向相应的 undo log，通过这些 undo 信息可以逐步重建旧版本，形成版本链。

执行快照读时，会根据 Read View，也就是读视图，判断记录版本对当前事务是否可见。当前版本可见就直接读取；不可见才沿着 undo 版本链，逐步重建并查找可见的历史版本。如果没有可见版本，这条记录在该快照下就不可见。重建旧版本用于查询，不会把当前记录实际回滚。

[[database-isolation-sources#InnoDB 的快照读|Read View 的创建时机与隔离级别有关]]：读已提交下，每次快照读都会创建新的 Read View；可重复读下，通常在事务第一次快照读时创建，后续快照读复用这个视图。本事务此前的修改仍然对自己可见。锁定读和写操作仍然需要锁来协调并发。
