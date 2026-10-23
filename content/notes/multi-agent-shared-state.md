---
title: "多 Agent 的共享状态"
parent: multi-agent-communication
category: "Agent"
tags: ["Agent", "多Agent协作", "上下文管理"]
learning_status: reading
created_at: "2026-10-22 14:41:09"
updated_at: "2026-10-23 20:07:59"
learning_status_changed_at: "2026-10-22 15:18:12.027"
---

**共享状态是成员约定共同使用的任务数据，由程序或框架应用更新，再交给后续步骤。** 模型可以通过工具提出修改，也可以只生成结果，由节点代码自动提交；共享哪些字段、谁能读写，仍由应用约定。以下用[[multi-agent-shared-state-sources|LangGraph 与 Google ADK 的官方例子和源码]]说明。

## LangGraph：返回增量，步末合并

`StateGraph` 用字段定义状态。官方报告生成例子中，各 worker 调用模型撰写自己的章节，返回 `{"completed_sections": [section.content]}`；`completed_sections` 配置 `operator.add` 作为合并函数（reducer），由运行时把章节列表拼接起来。

**reducer 是程序合并函数，不负责分工与决策；它可以保留两份互相矛盾的章节，不会自动消除矛盾。**

![[assets/multi-agent-shared-state-runtime.png|640]]

**同一步并行的 worker 不会读到彼此本步的新结果。** 运行时在步末应用更新，再按图的依赖启动后续节点；该例的 `synthesizer` 读取合并列表并拼接报告，无需自行轮询。图中的报告只是拼接产物，尚未经过内容验收；若后续还要调用模型，节点代码须显式将所需状态放进[[agent-context-input|模型输入]]。

普通字段没有合并函数时，同一步多个节点更新它会报 `INVALID_CONCURRENT_GRAPH_UPDATE`。因此，开发者需要划分不同输出字段，或为确实需要共同更新的字段定义合并规则，不能假定框架会自动保留最后一份。

## Google ADK：输出写入会话，后续请求读取

ADK 的 `session.state` 是会话内的键值数据。在普通对话模式下，开发者配置 `output_key`，框架就会把模型输出放入事件的 `state_delta`，再由 SessionService 应用或保存。

官方串行例子让 CodeWriter 使用 `output_key="generated_code"`；后续 CodeReviewer 的提示含 `{generated_code}`。程序构建审查请求时，从状态取出代码替换占位符，模型才会看到实际内容。这里由流程先完成写入、再启动读取，也不需要定时查询文件。

官方并行研究例子则让三名研究员分别写不同的输出键，全部完成后再汇总。这是划分写入归属的做法；同键竞争及跨运行保存的保证仍取决于执行方式与 SessionService，具体边界见[[multi-agent-shared-state-sources#ADK 的并发边界|版本与源码说明]]。

## 重叠、矛盾的内容，最终怎样处理

图中的拼接只完成收集，最终采纳还需要单独的[[multi-agent-shared-state-sources#收集结果以后，怎样核验与采纳|核验与修订流程]]。例如 A 写「接口超时 30 秒」，B 写「60 秒」，应用应安排：

1. **核对对象与条件**：是否为同一接口、版本和环境？条件不同就分别说明；确属重复内容再合并并保留出处。
2. **同条件下查证**：对照实际配置、原始资料或可执行检查，确定哪份应更正；由成员修订，再核对通过后写入最终结果。
3. **无法确定时保留未决**：保留候选与证据，继续补查或转人审；达到次数或预算上限也不能冒充验收通过。

ADK 的官方文稿改进例子采用 Critic 检查、Refiner 修订、程序循环调度。它演示职责分离，不保证事实自动正确。没有主管时，也可由程序固定安排或成员交叉复核；**有无主管，与是否需要核验和采纳规则，是两个维度。**

在这些工作流中，B 若必须使用 A 的新结果，应建立先 A 后 B 的依赖；步骤边界不承诺固定响应时间。独立 Agent 服务还须另行安排[[multi-agent-message-passing|通信与更新通知]]及存储并发控制。

状态持久化与恢复需另行配置具备相应能力的[[langgraph-checkpoints|检查点]]或 SessionService 后端。本文已核对官方文档与源码，未运行真实模型或并发实验。
