---
title: "什么时候应该用 Agent，什么时候不需要？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "工程选型"]
learning_status: organized
created_at: "2026-10-21 12:34:07"
updated_at: "2026-10-21 12:40:20"
learning_status_changed_at: "2026-10-21 12:43:43.565"
---

我会先看**任务的步骤和分支能不能提前确定**。如果流程比较固定，只需要在其中结合检索结果、调用模型做理解和推理，就优先用[[agent-vs-workflow|工作流（Workflow）]]。即使有多次模型调用、分支和重试，也不一定需要 Agent，由程序提前编排更容易控制和验证。

当任务目标明确，但执行路径需要根据实际反馈不断调整时，我才会考虑 [[agent|Agent]]，让模型持续观测结果、分析情况，再决定下一步行动。判断重点是是否需要这种动态决策，任务复杂、输入多样本身并不足以说明需要 Agent。

选择时还要考虑成本、延迟和错误累积的风险，按[[anthropic-effective-agents-summary|从简单方案开始的原则]]，通过评估确认收益。两者也可以结合，整体用工作流，只在需要灵活判断的环节使用 Agent。
