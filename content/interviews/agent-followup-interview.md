---
title: "Agent 执行中怎样接收用户的新要求？"
aliases: ["Agent 执行中追加消息", "用户主动补充或修改要求"]
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "上下文管理"]
type: practice
learning_status: organized
created_at: "2026-10-20 16:04:02"
updated_at: "2026-10-21 22:15:16"
learning_status_changed_at: "2026-10-22 09:18:15.113"
---

我会先把执行期间收到的新要求放进**待处理队列**，暂不写入对话历史。等当前这一轮工具调用结束，[[agent-loop|Agent Loop]] 在组装下一次模型请求时，再取出新消息，**只将本轮新增的工具结果和用户消息追加写入数据库或文件**，原有消息无需重写。

这里的**对话历史指存储历史**，也就是已经保存的消息记录；[[agent-context-input|上下文]] 则是程序从历史等信息中选取、组装后，实际提供给模型的输入，两者有区别。已经发出的请求不会改变，新要求从下一次模型调用开始生效。

![[assets/agent-followup-context-v4.png|720]]
