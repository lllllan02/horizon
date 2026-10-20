---
title: "页面刷新或断线后，怎样恢复 Agent 任务和流式输出？"
aliases: ["Agent 断线重连", "Agent 流式输出恢复"]
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent"]
type: practice
learning_status: organized
created_at: "2026-10-20T16:07:29+08:00"
updated_at: "2026-10-20T16:12:06+08:00"
learning_status_changed_at: "2026-10-20T16:13:17.502+08:00"
---

Session 对应一次会话，run 对应其中的一次任务。刷新或重连后，我会先通过 Session ID 找回会话，再查询要恢复的 Run ID。按会话或 run 订阅都可以，但事件里要带上 Run ID，避免不同轮次的输出混在一起。

后台 Agent Loop 不随页面断线停止。模型的流式增量先写入 [[redis-stream-replay-sources#按事件位置补读与等待新消息|Redis Streams]]，再由订阅服务转发给页面；数据库或文件可以攒一批再保存。

恢复时，「**先订阅并缓存新事件，再取历史记录，最后合并展示**」。历史记录要带上对应的事件位置，从该位置补读后续增量，再按事件 ID 去重、顺序合并，避免漏掉尚未落库的内容。

[[agent-cancellation-sources#Redis 通知可能丢失|Redis Pub/Sub]] 只负责实时通知，补读还要有可回放记录；事件过期则改用能覆盖缺口的完整快照或最终结果。页面按服务端的[[agent-progress-interview|真实任务状态]]恢复展示，重连不重新提交任务。
