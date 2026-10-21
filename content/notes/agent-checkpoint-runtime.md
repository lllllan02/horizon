---
learning_status: organized
title: "单 Agent Loop 的 Checkpoint"
parent: agent-checkpoint-recovery
category: "Agent"
tags: ["Agent", "Checkpoint", "持久化"]
created_at: "2026-10-13 11:07:38"
updated_at: "2026-10-19 21:37:28"
reading_suggestions:
  - agent-loop
  - eino-checkpoint
learning_status_changed_at: "2026-10-19 21:46:58.097"
---

在单个 [[agent-loop|Agent Loop]]、工具串行执行的情况下，用阶段与工具下标就能定位下一步。保存与恢复的共同流程见[[agent-checkpoint-recovery|Checkpoint 总览]]。

## 记录内容

Checkpoint 包含两个控制字段，以及一个可选的数据引用：

1. `stage`：决定下一步进入哪个执行入口。

   - `model`：调用模型。
   - `tools`：调用工具。
   - `done`：执行结束。

2. `next_tool`：本批工具请求中下一项的下标，从 0 开始：`0` 是第一项，`1` 是第二项。仅在工具阶段使用。
3. `state_ref`：定位已保存的上下文、原工具请求列表及结果；调用方已确定这份数据时可以省略。

这些字段是自拟的最小结构；[[eino-checkpoint|Eino]]则用图节点键和组件状态表达执行位置。

## 记录示例

模型返回的请求依次是 `read_doc("A")`、`read_doc("B")`。A 的结果已保存、B 尚未执行时，[[assets/agent-loop-checkpoint-example.json|完整快照]]中的控制部分是：

```json
{
  "stage": "tools",
  "next_tool": 1,
  "state_ref": "state-3"
}
```

## 如何定位下一步

程序用 `switch stage` 选择入口；本例进入工具阶段，取原列表中的 `ToolCalls[1]`，按其中的名称和参数执行 B。请求列表及顺序保持不变，下标才有相同含义。

![[assets/agent-loop-checkpoint-overview.png|640]]

[[assets/agent-loop-checkpoint-dispatch.go|Go 调度示例]]读取这组快照并打印选中的动作，使用标准库，运行命令在文件开头；它只演示入口选择，不实际调用模型或工具。
