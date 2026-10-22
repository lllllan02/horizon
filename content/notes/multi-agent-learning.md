---
title: "多 Agent 协作学习入口"
aliases: ["Multi-Agent Learning Path", "多 Agent 开发学习路线"]
parent: agent
category: "Agent"
tags: ["Agent", "多Agent协作", "工程选型"]
type: overview
learning_status: reading
created_at: "2026-10-22 11:40:38"
updated_at: "2026-10-22 17:09:43"
learning_status_changed_at: "2026-10-22 11:56:56.256"
---

多 Agent 协作让多个能够分别判断和行动的执行者，通过任务、信息和成果传递，共同完成一个目标。本专题先说明为什么需要分工，再学习编排怎样组织执行、信息流转与持续协作。

## 正文

1. [[multi-agent-benefits|为什么需要多个 Agent]]：说明哪些场景值得拆分，以及收益和协调成本。
2. [[multi-agent-orchestration|多 Agent 的编排]]：认识常见流程与协作模式，理解信息与成果传递怎样支撑持续分工、评价与修订。

## 材料与实验

[[multi-agent-orchestration-sources|官方编排模式对照]]用于比较 Google ADK、LangGraph 与 Microsoft 的学习入口；[[langchain-multi-agent|LangChain 模式说明]]用于核对调用与控制流；[[anthropic-multi-agent-research|Anthropic 研究系统]]提供并行调查的经验；[[multi-agent-study-sources|编排术语、最小委派源码与工程经验]]用于继续阅读和比较。

读通概念后，再沿 smolagents 示例追踪注册、调用、工具执行与返回；它只是一个实现样例，不预先决定项目语言或框架。现有 Labs 也按学习问题评估，不以目录编号作为学习顺序。进入实验前固定源码与依赖，预先约定成功条件与预算，以单 Agent 或更简单的流程为对照，比较同批任务的质量、耗时、费用与失败，并通过缺失约束或分支失败检查执行。

当前材料解释基本机制与取舍，尚未运行示例或复现实验。共享任务板、成员直通、嵌套恢复、多模型及 A2A 按具体需要深入，不列为全部必修项。
