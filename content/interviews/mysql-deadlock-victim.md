---
title: "发生死锁时，InnoDB 会回滚哪个事务？"
aliases: ["死锁回滚对象", "Deadlock Victim"]
category: "MySQL"
parent: mysql-interview-index
tags: ["面试", "MySQL", "死锁", "事务"]
learning_status: organized
created_at: "2026-10-18 12:04:28"
updated_at: "2026-10-18 12:04:28"
learning_status_changed_at: "2026-10-18 22:07:52.960"
---

一般会优先回滚[[mysql-deadlock-reading#官方规则：失败后还剩下什么|「分量比较小」的事务]]，可以理解为尽量选择回滚代价较小的一方。这个分量会参考事务修改了多少行、持有多少锁，不能简单按谁先开始、谁后开始来判断，也不能认定最后触发死锁的事务一定会被回滚。

实际回滚了哪一个，可以在死锁报告里看 `WE ROLL BACK TRANSACTION` 对应的事务。

