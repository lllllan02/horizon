---
title: "ReAct Agent 的原理是什么？"
aliases: ["ReAct 架构", "ReAct Agent 原理"]
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "ReAct"]
learning_status: organized
created_at: "2026-10-19 13:36:28"
updated_at: "2026-10-21 12:52:46"
learning_status_changed_at: "2026-10-21 12:55:35.050"
---

[[react-agent|ReAct（Reasoning and Acting，推理与行动交替）]]是一种基础的 Agent 执行模式，让模型根据行动结果调整下一步决策。

当任务需要边获取外部信息、边决定下一步时，可以用「**决策 → 执行 → 观察与分析 → 再决策**」来理解它。按[[react-paper-summary|原论文]]中的术语，这个循环包含：

1. **推理（Thought）**：模型结合用户目标、工具说明和已有上下文，判断下一步做什么，选择工具及参数。
2. **行动（Action）**：模型提出工具调用请求，由程序实际执行工具。
3. **观察（Observation）**：工具返回结果或错误，程序将其加入上下文。模型再分析这些反馈，决定继续、换个方法或给出最终回答；这里的分析属于后续推理，不必单独拆成一次模型调用。

因此，**关键是执行反馈真正进入下一轮决策**。模型负责判断，程序负责执行、保存上下文和控制循环；这样的[[agent-loop|最小 Agent Loop]]就是 ReAct 的一种实现。模型给出最终回答时结束，程序还应设置轮数上限，防止无限循环；达到上限表示中止，不代表任务成功。

组织这个循环的程序就是基础的 [[agent-harness|Agent Harness]]。状态持久化、失败恢复、权限控制等，是围绕循环补充的运行能力。ReAct 描述推理与行动怎样配合，没有规定固定的软件架构，也不等同于所有 Agent 的定义。
