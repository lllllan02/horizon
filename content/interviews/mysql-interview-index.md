---
title: "MySQL 面试题"
aliases: ["MySQL 面试专题", "MySQL 面试题目录"]
category: "MySQL"
parent: interview-hub
tags: ["面试", "MySQL"]
type: overview
learning_status: pending
created_at: "2026-10-18T12:06:30+08:00"
updated_at: "2026-10-20T10:44:42+08:00"
learning_status_changed_at: "2026-10-18T23:19:25.671+08:00"
---

按主题整理 MySQL 面试问题与追问，每道题保留简短、自然的口述回答，原理和排查细节由题目中的链接承接。

## 事务与锁

- [[database-isolation-interview|数据库有哪些事务隔离级别，分别解决什么问题？]]
- [[mysql-deadlock-interview|MySQL 遇到死锁，如何排查和优化修复？]]
  - [[mysql-deadlock-victim|发生死锁时，InnoDB 会回滚哪个事务？]]
- [[mysql-transaction-retry|MySQL 事务失败后，哪些情况可以重试？怎么重试？]]

## 查询与性能

- [[mysql-slow-query-interview|MySQL 慢查询一般怎么优化？]]
- [[mysql-explain-interview|怎么看 MySQL 的 EXPLAIN？]]

## 容量与拆分

- [[mysql-sharding-interview|了解数据库的分库分表吗？]]
  - [[mysql-sharding-key-interview|分片键怎么选，多种查询维度如何兼顾？]]
