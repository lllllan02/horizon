---
title: "为什么需要多个 Agent"
parent: multi-agent-learning
category: "Agent"
tags: ["Agent", "多Agent协作", "工程选型"]
learning_status: organized
created_at: "2026-10-22 14:41:09"
updated_at: "2026-10-22 15:16:00"
learning_status_changed_at: "2026-10-22 17:01:42.433"
---

单 Agent 也能完成复杂任务；但当工作需要分别推进、独立判断或分别维护能力时，多个 Agent 可能更容易组织：

- **缩短等待**：让相对独立的任务分支[[anthropic-multi-agent-research#为什么有效，又在哪里失效？|并发推进]]，减少串行等待。
- **减少上下文干扰**：各自处理局部资料，[[langchain-multi-agent#具体怎样实现？|只返回关键发现与依据]]，减少汇总者接收的无关历史。
- **组合专业能力**：按子任务选择合适的指令、工具或模型，让[[multi-agent-study-sources#Cognition：单一写入者与独立判断|不同执行者发挥各自所长]]。
- **独立检查成果**：让另一成员[[multi-agent-study-sources#Cognition：单一写入者与独立判断|重新查证和审查]]，用于发现原过程的遗漏。
- **复用与独立维护**：将能力封装为可调用的 Agent，供不同流程组合，并由不同团队[[langchain-multi-agent#为什么分成这些模式？|分别开发和维护]]。

这些收益也可部分通过单 Agent 的并行工具、Skills 或工作流实现；是否值得拆分，仍要看收益能否覆盖沟通、信息传递与核查成本。
