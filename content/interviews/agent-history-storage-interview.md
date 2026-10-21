---
title: "Agent 的历史消息存数据库还是 JSONL 文件？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "上下文管理", "持久化"]
learning_status: organized
created_at: "2026-10-21 18:05:31"
updated_at: "2026-10-21 19:02:56"
learning_status_changed_at: "2026-10-21 19:17:34.543"
---

Agent 的[[history-storage|历史消息]]主要有两种[[agent-history-storage-sources|存储方案]]：

- **存数据库**：一条记录保存一条消息或事件。优点是方便查询、分页和统计，也有成熟的事务与并发控制；代价是需要维护表、索引和备份，MySQL 这类服务端数据库还需要部署维护。

- **存 JSONL 文件**：每行一个 JSON 对象，按事件顺序追加。优点是实现简单，容易查看和导出，无需独立数据库服务；代价是复杂查询、并发写入和故障恢复需要自己处理，不能只追加就认为可靠落盘。

所以，**本地工具、单写入者、主要顺序回放，可以先选 JSONL；多实例共享、需要查询和事务，优先考虑服务端数据库。**

保存的完整历史，再由[[agent-context|上下文管理]]筛选或压缩，组成本轮模型输入。
