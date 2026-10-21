---
learning_status: organized
parent: agent
title: "Agent 的 Checkpoint"
aliases: ["Agent Checkpoint", "Agent 中断恢复", "Agent 的中断恢复机制"]
category: "Agent"
tags: ["Agent", "Checkpoint", "持久化"]
created_at: "2026-10-09"
updated_at: "2026-10-19T21:37:28+08:00"
reading_suggestions:
  - agent-checkpoint-runtime
  - agent-checkpoint-nesting
  - agent-checkpoint-scheduling
learning_status_changed_at: "2026-10-19T21:57:18.886+08:00"
---

**检查点（Checkpoint）保存程序的执行进度，让 Agent 中断后能够找到接续位置。** 目标与业务进展由[[agent-task-state|任务状态管理]]维护，消息、工具请求和结果由[[history-storage|上下文管理]]保存；Checkpoint 关联这些数据，支撑原[[process|进程]]或新进程继续执行。

## 怎么保存

将执行位置、必要的调度状态与数据引用写入持久存储。结果和进度必须对应同一次提交：可以共同写入一个事务，也可以先保存不可变的数据快照，再提交引用它的 Checkpoint。不能让游标已经推进，对应结果却尚未保存。

保存的是可序列化的记录。连接、[[coroutine|协程]]和函数地址由新进程重新建立；Agent、节点和工具的执行定义必须与记录兼容。

## 什么时候保存

自建运行时可以在每次可恢复的进度变化后保存：

- **一步完成**：模型响应、工具结果或子 Agent 最终输出已确认，记录对应的下一步。
- **即将等待或启动子调用**：先保留输入、关联与继续条件，再交出控制权或开始子调用。
- **恢复条件变化**：收到[[tool-approvals|审批]]或异步结果、确定重试时间或停止执行时，提交相应控制状态。

未成功保存的工作可能需要重做。框架的保存边界各不相同，配置存储不等于自动在每一步落盘。

## 怎么恢复

1. **读回已提交状态**：加载检查点及其关联的数据，重建兼容的执行定义。
2. **还原待办与等待条件**：依据记录找出未完成的执行位置，复用已保存结果；结束的任务直接返回，等待条件未满足的继续等待。
3. **继续调度**：执行已经可以继续的部分，并在下一次进度变化后按同一规则保存。

外部请求已发出但结果未知时，先核查原操作或按接口幂等约定处理，不能仅凭本地没有结果就认定它尚未执行。

## 保存内容怎样演进

各篇统一说明记录内容、具体格式，以及程序怎样据此定位下一步；共同的保存与恢复流程沿用本文。

| 执行场景 | 记录内容的变化 |
| --- | --- |
| [[agent-checkpoint-runtime\|单 Agent Loop]] | 用阶段与工具下标定位串行执行位置 |
| [[agent-checkpoint-nesting\|嵌套 Agent]] | 每层保留自己的进度，并记录尚未返回的子调用 |
| [[agent-checkpoint-scheduling\|复杂调度]] | 按需补充并行分支、等待关联、未知调用及调度限制 |

## 实现参照

[[eino-checkpoint|Eino 的机制说明]]与[[eino-checkpoints|源码导读]]解释节点键、组件状态与执行对象的对应；[[langgraph-checkpoints|LangGraph]]展示图快照与部分完成结果，[[temporal-durable-execution|Temporal]]展示通过事件历史重建执行。

[[codex-session-recovery|Codex 的会话恢复]]和 [[claude-code-checkpoints|Claude Code 的会话与文件检查点]]说明产品中的接续与回退；这些能力与恢复任意程序执行位置的保证需要分别理解。
