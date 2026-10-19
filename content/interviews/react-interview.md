---
title: "ReAct 的架构是什么？"
aliases: ["ReAct 架构"]
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "ReAct"]
learning_status: organized
created_at: "2026-10-19T13:36:28+08:00"
updated_at: "2026-10-19T13:42:21+08:00"
learning_status_changed_at: "2026-10-19T13:43:59.407+08:00"
---

[[react-agent|ReAct]] 是一种 Agent 交互模式，**「核心是推理、行动、观察的循环」**，没有规定固定的软件架构。一个由模型根据工具结果决定下一步的[[agent-loop|最小 Agent Loop]]，就是这种模式的一种实现。

它的基本结构就是调用模型，让模型选择工具和参数，由程序执行，再把结果回填上下文。模型根据新的观察继续决策，直到完成回答或触发停止条件。

组织这个循环的程序就是基础的 [[agent-harness|Agent Harness]]。再补充状态持久化、失败恢复、权限控制等，属于 Agent 通用运行能力的扩展。
