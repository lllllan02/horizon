---
title: "ReAct Agent 和 Plan-and-Execute 分别适合什么场景？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "ReAct", "任务规划"]
learning_status: organized
created_at: "2026-10-21 12:53:29"
updated_at: "2026-10-21 13:12:41"
learning_status_changed_at: "2026-10-21 13:25:15.486"
---

[[react-agent|ReAct Agent]] 根据行动结果动态决定下一步，优势是「**能随新反馈灵活调整，不必先单独制定整体计划**」，适合较短的任务，或者需要边获取信息、边决定后续行动的场景。但面对长任务，如果只关注下一步，缺少整体计划和进度跟踪，就可能遗漏要求，或者持续沿着局部错误的方向推进。

[[plan-and-execute|Plan-and-Execute]] 先制定整体计划，再由执行器逐步完成子任务，优势是「**让各阶段围绕整体目标推进，减少遗漏和局部跑偏**」，适合较长、较复杂，而且主要阶段可以提前识别的任务。但计划可能不完善，执行中也可能发现某条路线走不通，所以需要结合反馈，必要时通过 [[agent-replanning|Replanning（重新规划）]] 调整剩余步骤。

**并非所有任务都值得提前规划**：制定和维护计划会增加开销，任务很短或信息变化很快时，规划的收益可能不足以抵消成本。两者也可以组合：整体先规划，每个步骤用 ReAct 动态执行，必要时再改计划。
