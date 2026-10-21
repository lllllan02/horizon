---
title: "MySQL 面试题"
aliases: ["MySQL 面试专题", "MySQL 面试题目录"]
category: "MySQL"
parent: interview-hub
tags: ["面试", "MySQL"]
type: overview
learning_status: organized
created_at: "2026-10-18 12:06:30"
updated_at: "2026-10-20 21:14:30"
learning_status_changed_at: "2026-10-21 10:11:21.744"
---

按主题整理 MySQL 面试问题与追问，每道题保留简短、自然的口述回答，原理和排查细节由题目中的链接承接。

## 事务与锁

- [[database-isolation-interview|数据库有哪些事务隔离级别，分别解决什么问题？]]
- [[mysql-mvcc-interview|为什么 MySQL InnoDB 使用 MVCC 实现事务隔离？]]
- [[mysql-deadlock-interview|MySQL 遇到死锁，如何排查和优化修复？]]
  - [[mysql-deadlock-victim|发生死锁时，InnoDB 会回滚哪个事务？]]
- [[mysql-transaction-retry|MySQL 事务失败后，哪些情况可以重试？怎么重试？]]

## 查询与性能

- [[mysql-index-structure-interview|MySQL 的索引结构是什么？]]
- [[mysql-covering-index-interview|什么是覆盖索引？]]
- [[mysql-deep-pagination-interview|MySQL 深分页怎么优化？]]
  - [[mysql-filter-pagination-interview|MySQL 多条件查询如何支持任意跳页？]]
- [[mysql-slow-query-interview|MySQL 慢查询一般怎么优化？]]
- [[mysql-explain-interview|怎么看 MySQL 的 EXPLAIN？]]

## 容量与拆分

- [[mysql-sharding-interview|了解数据库的分库分表吗？]]
  - [[mysql-sharding-key-interview|分片键怎么选，多种查询维度如何兼顾？]]
