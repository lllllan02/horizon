---
title: "Agent 的 Checkpoint 怎么实现？"
parent: agent-interview-hub
category: "Agent"
tags: ["面试", "Agent", "Checkpoint", "持久化"]
learning_status: organized
created_at: "2026-10-19T19:27:21+08:00"
updated_at: "2026-10-19T21:59:56+08:00"
learning_status_changed_at: "2026-10-19T22:09:36.016+08:00"
---

[[agent-checkpoint-recovery|Checkpoint]] 保存的是**程序的执行进度**，让程序中断后知道从哪里继续。上下文和任务状态分别由[[history-storage|上下文管理]]和[[agent-task-state|任务状态管理]]负责。

实现时，记录程序能识别的继续位置，比如具体 Agent、[[agent-checkpoint-runtime|执行阶段和下一个工具的下标]]。恢复时读取这些标记，进入对应 Agent 的执行入口，按阶段选择模型或工具调用。例如，工具串行执行时，记录的是「工具阶段，下标 1」，就取出原工具列表中的第二个工具继续执行。
