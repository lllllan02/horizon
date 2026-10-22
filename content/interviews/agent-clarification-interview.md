---
title: "用户描述模糊时，怎样优化 Agent 的处理？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "意图识别"]
learning_status: organized
created_at: "2026-10-21 20:06:02"
updated_at: "2026-10-21 20:58:36"
learning_status_changed_at: "2026-10-21 20:59:54.626"
---

我会从提示词、任务状态和评测三个方面，优化模型的[[agent-clarification-interview-sources|需求澄清能力]]。

1. **提示词明确交付、检查输入缺口**：让模型先整理「要做什么、交付什么、必须满足哪些要求」，再对照交付检查现有输入还缺什么、是否有冲突。缺失的关键信息不靠猜，先从已有上下文、可信资料或工具获取；仍无法确定、影响交付的内容，再针对性向用户追问。
2. **任务状态衔接多轮补充**：模型持续[[agent-task-state-update|更新]]目标、已确认要求和待解决问题，由程序保存为[[agent-task-state|任务状态]]。收到追加消息时，先合并补充、修正改口，再判断是否需要追问，避免遗忘和重复询问。
3. **错例评测校准判断**：用漏问、多问和理解错误的真实对话[[intent-evaluation|评测]]，据此迭代提示词与对照样本。
