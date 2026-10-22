---
title: "父子 Agent 之间如何交互和传递上下文？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "多Agent协作", "上下文管理"]
learning_status: organized
created_at: "2026-10-19 17:26:36"
updated_at: "2026-10-21 21:15:02"
learning_status_changed_at: "2026-10-21 21:15:22.344"
---

父子 Agent 之间是否需要传递上下文，我认为要**根据业务场景做取舍**，可以区分[[langchain-multi-agent#具体怎样实现？|独立子任务和链式交接]]两种情况。

如果子 Agent 只是完成一个独立子任务或子模块，给它清晰的输入、目标、要求和预期产出，让它完成后交付即可，通常不需要主 Agent 的完整上下文。

如果是链式调用，比如 Agent A 完成任务后交给 B，再交给 C，就需要传递后续工作依赖的[[agent-task-state|任务状态和关键成果]]。**A 执行中的无关探索过程可以剔除，后续依赖的结果要保留**，减少中间过程带来的上下文干扰。
