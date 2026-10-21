---
title: "复杂调度的 Checkpoint"
parent: agent-checkpoint-recovery
category: "Agent"
tags: ["Agent", "Checkpoint", "持久化"]
learning_status: organized
created_at: "2026-10-19 21:37:28"
updated_at: "2026-10-19 21:37:28"
reading_suggestions:
  - agent-checkpoint-runtime
  - agent-checkpoint-nesting
learning_status_changed_at: "2026-10-19 21:48:28.526"
---

**完整的 Checkpoint 要覆盖恢复所需的控制信息，字段随运行时支持的能力增加。** [[agent-checkpoint-runtime|串行 Loop]]只需阶段与下标，[[agent-checkpoint-nesting|串行嵌套]]增加父子进度；支持并行、异步调用和人工等待后，还要区分各个请求的状态。共同的保存与恢复流程仍沿用[[agent-checkpoint-recovery|总览]]。

## 记录内容

以下是自拟的扩展结构。信息可以由调度器、工具运行记录、事件收件箱或任务控制模块持久保存，Checkpoint 只保留必要的记录或引用。

1. `tasks`：以原工具调用 ID 为键，分别保存各请求的进度，代替一个串行 `next_tool`。每项的 `status` 表示：

   - `pending`：尚未开始，待检查执行条件。
   - `done`：结果已保存。
   - `waiting`：等待回复或其他继续条件。
   - `unknown`：原外部调用的结果尚未确认。

   并行子 Agent 的 `child` 放在各自请求之下。

2. 每项请求中的 `wait`：等待条件对象，包含 `kind`（等待类型，如审批）和 `event_key`（对应哪项回复）。回复本体由持久事件存储保留，直到被正确消费；只有一个笼统的等待阶段无法匹配回复。
3. 每项请求中的 `operation_ref`：定位原外部调用的运行记录，其中保存查询凭据或幂等键。关联必须在发出前可靠保存或可确定，才能处理「远端已成功、本地没收到结果」的窗口。
4. `control_ref`：定位影响调度的控制信息，例如重试等待时间、已用重试额度、总期限和取消决定。只保留实际采用的限制；已有[[agent-retry|重试]]或任务控制模块维护时直接读取，不用旧 Checkpoint 覆盖新的取消决定。

[[tool-scheduling|调用依赖]]也必须能找回：固定依赖从兼容的程序定义读取，动态依赖随本次运行持久保存。能由依赖与已完成集合推导的就绪队列，不再重复记录。[[eino-checkpoints#并行依赖怎样进入检查点？|Eino 的依赖状态]]与 [[langgraph-checkpoints#什么算一个完整检查点？|LangGraph 的部分完成记录]]提供了实现参照。

## 记录示例

当前仍在工具阶段，但 A 已完成，B 等待审批，C 的远端结果未知，因此无法用一个下标表示：

```json
{
  "agent_key": "planner",
  "stage": "tools",
  "state_ref": "state-42",
  "tasks": {
    "call-A": {"status": "done"},
    "call-B": {
      "status": "waiting",
      "wait": {"kind": "approval", "event_key": "approval-B"}
    },
    "call-C": {
      "status": "unknown",
      "operation_ref": "operation-C"
    }
  },
  "control_ref": "control-42"
}
```

`state-42` 关联原请求列表、A 的结果及本次运行的动态依赖；`operation-C` 关联 C 的调用凭据，`control-42` 关联调度限制。它们是不同存储的示意引用，不要求额外复制结果和业务状态。

## 如何定位下一步

- **A 已完成**：复用原结果，不再次调用。
- **B 等回复**：按 `approval-B` 查找已保存的回复；没有回复就继续等待，有回复则校验后消费，并提交相应进度。[[langgraph-human-interrupts|定向恢复]]也需要区分具体等待点。
- **C 结果未知**：先通过原调用记录查询；只有按接口约定确认后，才决定复用结果、继续等待或使用同一幂等键重试。

每项重新具备执行条件时，还要读取当前调度限制；已取消或超过总期限时按停止策略处理。跨程序升级恢复时，可另加 `definition_ref` 选择兼容定义或执行迁移；版本号本身不能自动解决兼容问题。

本篇是结构设计，未实现完整的并发调度器，也不以这些字段承诺外部操作只执行一次。
