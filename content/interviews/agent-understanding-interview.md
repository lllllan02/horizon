---
title: "你怎么理解 Agent 系统？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "Harness"]
learning_status: organized
created_at: "2026-10-21 12:26:52"
updated_at: "2026-10-21 12:33:36"
learning_status_changed_at: "2026-10-21 12:38:29.688"
---

我会从一次普通的文本模型调用说起：我们问一个问题，模型生成一个回答。Agent 在这个基础上接入[[tool-calling|工具调用]]，让模型能够借助工具获取信息、执行操作，延伸它的工作能力。

我理解的 [[agent|Agent（智能体）]]，就是**以大模型为核心，能够围绕目标自主规划任务、调用工具，并根据执行结果的反馈动态调整行动的系统**。它按照「**决策 → 执行 → 观测 → 再决策**」的循环，持续朝着目标推进，直到完成任务或达到运行限制。

从架构上看，模型负责理解目标和决策，程序负责执行工具调用，[[agent-context|上下文管理]]负责在循环中组织每轮模型调用的消息，保留目标、进度和关键结果。这些运行能力由 [[agent-harness|Harness]] 组织起来，再按需要补充权限控制、状态保存和失败恢复等能力。
