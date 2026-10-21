---
title: "JSONL、MySQL 与 SQLite：历史存储的能力边界"
category: "Agent"
tags: ["Agent", "持久化"]
learning_status: pending
created_at: "2026-10-21 18:05:31"
updated_at: "2026-10-21 18:05:31"
source:
  - "https://jsonlines.org/"
  - "https://man7.org/linux/man-pages/man2/write.2.html"
  - "https://man7.org/linux/man-pages/man2/fsync.2.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-introduction.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-parameters.html#sysvar_innodb_flush_log_at_trx_commit"
  - "https://www.sqlite.org/whentouse.html"
---

这些维护方文档分别解释**逐行记录格式、文件写入保证与数据库提供的能力**。本文仅摘取与 Agent 历史存储选型有关的部分；文档未直接比较 Agent 工作负载，面试题中的场景建议属于工程归纳。

## JSONL 规定记录格式，写入保证由实现提供

[JSON Lines 格式说明](https://jsonlines.org/)要求 UTF-8 编码、每行一个有效 JSON 值、以换行符分隔；JSON 值也可以是数组或 null，Agent 会话通常约定每行一个事件对象。页面说明这种格式适合逐条处理、日志与文本工具，并建议最后一条记录后也加换行，方便追加和拼接。它没有规定会话字段、事务或并发控制。

Linux [write(2)](https://man7.org/linux/man-pages/man2/write.2.html)说明，成功调用也可能只写入部分字节。`O_APPEND` 保证定位到文件末尾与本次写入作为一个原子步骤，但一条 JSON 记录可能经过多次写入，所以不能由追加模式推导出整条记录天然原子。[fsync(2)](https://man7.org/linux/man-pages/man2/fsync.2.html)负责将文件缓存数据及相关元信息同步至存储设备，目录项的持久化还有单独要求。这些是 Linux/POSIX 文件接口的说明，其他平台需核对对应保证。

由此可以归纳：应用需要处理短写与错误，协调同一文件的写入者，并定义刷盘和恢复规则。崩溃后若最后一行是不完整的 JSON，应识别并按恢复策略处理；不能把任意位置的解析错误都当作可直接忽略的尾行。这里是设计建议，未做故障注入验证。

## InnoDB 提供事务与恢复，持久化仍有配置条件

MySQL 8.4 [InnoDB 简介](https://dev.mysql.com/doc/refman/8.4/en/innodb-introduction.html)说明，事务支持提交、回滚与崩溃恢复；行级锁和一致性读用于支持多用户并发，主键索引用于定位记录。将事件按会话归属、顺序号组织，并用同一事务写入相关进度，是基于这些能力的应用设计；数据库不会自动知道 Agent 的逻辑事件顺序。

[日志刷盘参数](https://dev.mysql.com/doc/refman/8.4/en/innodb-parameters.html#sysvar_innodb_flush_log_at_trx_commit)说明，默认值 1 在每次事务提交时写入并刷出日志，0、2 则可能在故障中丢失尚未刷盘的事务；涉及二进制日志和复制时还要核对相关配置。**崩溃恢复与已提交数据的耐久性需要分别看待**，不能把使用数据库直接等同于任何故障下都不丢消息。

## SQLite 说明「本地文件」也能提供数据库能力

SQLite [适用场景](https://www.sqlite.org/whentouse.html)将自身定位为应用本地存储，强调无需独立服务管理、可用一个数据库文件承载结构化数据，并支持 SQL 查询和原子更新。因此，需要索引与事务，不必直接引入 MySQL 这类独立服务。

同一文档也明确：SQLite 允许多个读取者，**同一时刻只允许一个写入者**；写密集或需要多台服务器共享访问的场景，应考虑客户端／服务端数据库。许多机器直接通过网络文件系统共同打开数据库文件，还会受到网络延迟和文件锁可靠性的限制。因此，SQLite 可以作为本地历史存储的候选，但不能由「也是数据库」推断它与 MySQL 有相同的并发模型。

资料核对于 2026-10-21，MySQL 为 8.4 文档，其余为维护方在线文档；未进行性能对比、并发写入或掉电恢复实验。
