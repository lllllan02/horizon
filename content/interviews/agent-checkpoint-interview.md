---
title: "Agent 的 Checkpoint 应该保存什么，才能在中断后恢复？"
parent: agent-interview-hub
category: "Agent"
tags: ["面试", "Agent", "Checkpoint", "持久化"]
learning_status: reading
created_at: "2026-10-19T19:27:21+08:00"
updated_at: "2026-10-19T19:44:05+08:00"
learning_status_changed_at: "2026-10-19T19:38:57.327+08:00"
---

[[agent-checkpoint-recovery|Checkpoint]] 的核心职责是**「保存程序的执行进度，让程序中断后能够找到接续执行的位置」**。目标、约束和业务进展由[[agent-task-state|任务状态管理]]维护，消息、工具调用请求和结果由[[history-storage|历史存储与上下文管理]]保存；Checkpoint 记录执行位置、调用状态，并关联恢复所需的数据。

在这个分工下，我会保存下面几类信息，让恢复程序能够确定「恢复谁、从哪里恢复、接下来执行什么」：

- **「执行实例标识」**：保存运行 ID 和 Agent 执行实例 ID，区分同一个 Agent 定义的多次调用；同时关联兼容的流程定义版本，让节点标识能对应到正确的执行逻辑。
- **「节点与执行阶段」**：保存节点 ID、当前轮次和阶段。例如 `phase=execute_tools` 表示模型响应已经确定，接下来处理工具；`phase=call_model` 表示进入模型调用阶段。只记录「在 Agent Loop 中」还不够，必须能区分这一轮已经走到哪一步。
- **「调用关系与调度状态」**：多层 Agent 保存父子执行实例的关联，以及子 Agent 完成后父 Agent 的继续位置；有并行分支时，分别记录哪些可执行、哪些在等待、哪些已完成，以及汇合条件，不能只保存一个当前节点。
- **「每次工具调用的进度」**：用调用 ID 关联原始请求，分别记录未执行、等待结果、已完成、失败或结果未知，并关联已经持久化的结果。恢复时据此跳过已完成调用、处理剩余调用；等待审批的调用还要关联具体等待项和继续条件。
- **「恢复数据的引用与边界」**：关联对应的任务状态版本、上下文快照、模型响应和工具请求／结果记录。数据可以由其他模块保存，但引用要固定到这份执行进度对应的版本，不能恢复时随意拼接各模块的最新数据。

自拟的[[assets/agent-checkpoint-example.json|多层 Agent 执行快照]]中，`root` 和 `researcher` 都在等子 Agent；最内层 `reader-001` 位于 `agent_loop` 的 `execute_tools` 阶段。`call-read-001` 的结果已保存，`call-read-002` 尚未执行，所以程序恢复后先执行第二个工具，再进入该层的模型调用，子 Agent 完成后按记录逐层返回。

**「执行位置与引用的数据要形成一致的可恢复进度」**。请求已发出但结果未保存时，不能当作未执行，应查询原操作或按远端幂等约定重试。这里恢复的是逻辑阶段，节点内部可能从入口重跑；[[eino-checkpoints|Eino 的中断地址与节点状态]]、[[codex-session-recovery|Codex 的历史重建]]提供了不同实现参考，[[claude-code-checkpoints|Claude Code 的文件回退]]则应与这类执行恢复区分。
