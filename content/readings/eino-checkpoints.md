---
title: "Eino 的检查点与中断恢复"
parent: agent-checkpoint-recovery
category: "Agent"
tags: ["Agent", "Checkpoint", "持久化", "Go"]
learning_status: pending
learning_status_changed_at: "2026-10-17 21:42:39.524"
created_at: "2026-10-14 14:43:35"
updated_at: "2026-10-19 21:44:24"
source:
  - "https://www.cloudwego.io/zh/docs/eino/core_modules/eino_adk/agent_hitl/"
  - "https://www.cloudwego.io/zh/docs/eino/core_modules/chain_and_graph_orchestration/checkpoint_interrupt/"
  - "https://github.com/cloudwego/eino/blob/v0.9.14/adk/runner.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.14/adk/interrupt.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.14/compose/checkpoint.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.14/adk/chatmodel.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.14/adk/runctx.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.14/internal/serialization/serialization.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.14/compose/graph.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.14/compose/graph_run.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.14/compose/tool_node.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.14/adk/react.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.14/adk/agent_tool.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.14/compose/dag.go"
---

Go Agent 在工具执行前等待审批，需要把当前进度交给存储，再由后续请求接手。Eino 提供了这条路径：**工具发出中断 → 框架保存检查点 → 应用收到审批后发起恢复 → 工具读取原状态与审批结果，继续执行。**

本文节选官方中断恢复文档，并核对 Eino v0.9.14 源码，重点是 ADK 的 ChatModelAgent 与 Runner。2026-10-19 另行运行无模型的 Graph 示例验证保存与跨进程恢复；未重新运行项目原有 ADK 实验，不将在线文档中的其他版本接口混入示例。

## 工具怎样停下来，并保留待审批内容？

以发布草稿为例，工具在实际发布前返回 `compose.StatefulInterrupt(ctx, info, state)`。`info` 是给用户看的审批信息，`state` 是恢复时还要使用的草稿或操作 ID。这个特殊错误沿 Tool、ChatModelAgent 传播到 Runner，成为中断事件；不会像阻塞等待那样一直占住原来的调用。

[HITL 架构指南](https://www.cloudwego.io/zh/docs/eino/core_modules/eino_adk/agent_hitl/)区分两个标识：`CheckPointID` 定位整份执行记录，`InterruptID` 定位其中某个中断点。一次运行可以有多个工具等待不同决定，因此恢复时需要知道批的是哪一项，不能只凭「任务已恢复」就放行所有工具。

## 检查点里保存了什么？

[Runner 的保存实现](https://github.com/cloudwego/eino/blob/v0.9.14/adk/interrupt.go)收集运行上下文、中断 ID 到组件地址的映射、各组件的中断状态和流式模式，用 gob 编码成字节，再调用存储的 `Set`。组件地址用于找到恢复路径，组件状态用于还原该路径上的执行进度。

外层结构的字段是 `RunCtx`、`Info`（保留兼容）、`EnableStreaming`、`InterruptID2Address` 和 `InterruptID2State`。[RunCtx](https://github.com/cloudwego/eino/blob/v0.9.14/adk/runctx.go)保存根输入、运行路径和会话；会话中还有共享值与 Agent 事件。因此，中断工具自行保存的草稿或参数只是整份记录的一部分。

ChatModelAgent 内部还运行着 Graph。其内部检查点通过[桥接存储](https://github.com/cloudwego/eino/blob/v0.9.14/adk/chatmodel.go)进入 Agent 的中断状态；[Graph 检查点](https://github.com/cloudwego/eino/blob/v0.9.14/compose/checkpoint.go)保存节点输入、图状态、待重跑节点、通道及子图状态。因此保存对象既有业务数据，也有框架继续调度所需的信息，并非只有对话消息。

业务提供 `CheckPointStore`：v0.9.14 的接口是 `Get(ctx, id) ([]byte, bool, error)` 与 `Set(ctx, id, data) error`，通过 `adk.RunnerConfig.CheckPointStore` 注入。要跨进程恢复，存储须在进程退出后仍可读取；多实例还要能访问同一份数据。内存 map 只能演示同进程恢复。

## 节点键与待执行任务

[图编译实现](https://github.com/cloudwego/eino/blob/v0.9.14/compose/graph.go#L730-L757)将节点键映射到包含执行对象的 `chanSubscribeTo`。中断时，[`handleInterrupt`](https://github.com/cloudwego/eino/blob/v0.9.14/compose/graph_run.go#L501-L574)把下一批任务的节点键与输入写入 `cp.Inputs`；恢复时，[`restoreTasks`](https://github.com/cloudwego/eino/blob/v0.9.14/compose/graph_run.go#L777-L825)按键查回执行对象，再组装 task。未在新图中注册的键会导致恢复报错，不能把任意字符串或代码行号当成有效恢复位置。

[`newReact`](https://github.com/cloudwego/eino/blob/v0.9.14/adk/react.go#L355-L559)注册 `ChatModel`、`ToolNode`、`CancelCheck`、`AfterToolCalls` 等节点，所以模型调用与工具执行已有不同的节点标识；实际接续节点取决于断点位置。[[eino-checkpoint|保存与恢复的学习说明]]围绕这个映射展开，[[assets/eino-checkpoint-source.txt|源码节选]]保留了完整的 `restoreTasks` 与相关状态结构。

## ToolsNode 怎样保留部分完成结果？

[`toolsInterruptAndRerunState`](https://github.com/cloudwego/eino/blob/v0.9.14/compose/tool_node.go#L309-L314)包含原始模型消息 `Input`、已完成普通工具结果 `ExecutedTools`、增强工具结果 `ExecutedEnhancedTools` 和中断工具列表 `RerunTools`。`ToolsNode.Invoke` 在工具发生受支持的中断时，通过 `CompositeInterrupt` 带出这些组件状态；Graph 会保存需重进的节点与中断状态。

恢复重新进入工具节点后，程序从中断状态读回原始输入及完成结果，再由 [`genToolCallTasks`](https://github.com/cloudwego/eino/blob/v0.9.14/compose/tool_node.go#L777-L825)按调用 ID 匹配结果。匹配的任务标为 `executed`；[`runToolCallTaskByInvoke`](https://github.com/cloudwego/eino/blob/v0.9.14/compose/tool_node.go#L892-L933)直接跳过它，其他调用继续处理。**「重新进入 ToolNode 可以复用已完成结果」**，但这依赖中断状态已成功保存；这里仅静态核对源码，未新增部分工具中断实验。

## 并行依赖怎样进入检查点？

Graph 的 `Channels` 可以保留节点输入与依赖状态。v0.9.14 的 [`dagChannel`](https://github.com/cloudwego/eino/blob/v0.9.14/compose/dag.go#L42-L74)包含 `ControlPredecessors`（waiting／ready／skipped）、`DataPredecessors`、`Values` 和 `Skipped`；`load` 将保存的通道内容恢复到当前通道，随后 [`get`](https://github.com/cloudwego/eino/blob/v0.9.14/compose/dag.go#L128-L175)检查依赖，满足条件才产生节点输入。

因此，并行恢复还涉及哪些前置已满足、哪些被跳过及哪些输入已到达，不能只用一个串行工具下标概括。这是 Eino Graph 的具体实现；自建调度器若能从固定依赖图与完成集合推导就绪状态，不必照抄整套字段。本节仅核对源码，未新增并行恢复实验。

## AgentTool 怎样保留子 Agent 的进度？

把 Agent 包装成工具后，父工具中断时需要保留子运行的检查点，才能在恢复时重新进入这个子运行。v0.9.14 的 [`AgentTool.InvokableRun`](https://github.com/cloudwego/eino/blob/v0.9.14/adk/agent_tool.go#L164-L210)区分首次执行与恢复：首次建立桥接存储并调用子 Runner 的 `Run`；恢复时从工具中断状态取出子检查点字节，重建桥接存储，再调用 `Runner.Resume`。

子 Agent 中断后，[向上传播的实现](https://github.com/cloudwego/eino/blob/v0.9.14/adk/agent_tool.go#L251-L261)从桥接存储取出检查点字节，将它作为父工具 `CompositeInterrupt` 的状态；子 Agent 正常完成时，[最后输出被提取为工具结果](https://github.com/cloudwego/eino/blob/v0.9.14/adk/agent_tool.go#L268-L279)。因此，父工具的恢复状态中可以继续包含子 Agent 的恢复状态，而不只是保存工具名称。

Graph 层也用 [`SubGraphs map[string]*checkpoint`](https://github.com/cloudwego/eino/blob/v0.9.14/compose/checkpoint.go#L107-L117)保存嵌套快照，并[按父节点键向子图传递](https://github.com/cloudwego/eino/blob/v0.9.14/compose/checkpoint.go#L158-L168)。这些是框架内部的层级保存机制，不等于业务 JSON 中统一存在一个 `child` 字段。这里静态核对了官方模块源码，未运行完整的 Eino 嵌套 Agent 恢复实验；[[agent-checkpoint-nesting|递归父子进度设计]]及其 Go 演示是另行编写的教学实现。

## 实际保存后的数据长什么样？

[[assets/eino-checkpoint-demo.go|可运行的 Graph 示例]]包含 `draft → publish` 两个节点，在 `publish` 前设置静态中断。它不调用模型和外部服务，发布节点也只打印文本；在引入 Eino v0.9.14 的 Go module 中运行，`-dir` 指定保存目录，第二个进程加 `-resume` 读取同一记录。

[[assets/eino-checkpoint-saved.json|实际保存的 Graph Checkpoint]]是该示例写入 Store 的原始 JSON 字节经过缩进后的完整内容：`Inputs` 中有待执行 `publish` 的输入，`State` 中有草稿和业务状态，另有通道与中断地址。**「这个例子的下一步体现在 Inputs 中，RerunNodes 为 null」**；不能把待执行节点与中断后需要重跑的节点混为一谈。

Graph 默认[序列化器](https://github.com/cloudwego/eino/blob/v0.9.14/internal/serialization/serialization.go)还写入 `Type`、`MapValues`、`JSONValue` 等类型信息，以便把 `any` 恢复为原类型；例如业务状态类型名为 `horizon_checkpoint_draft_v1`。**「这是 Graph 的实际格式；ADK Runner 外层使用 gob」**，两层不能统一说成普通业务 JSON。

本次两个独立 `go run` 进程的结果是：首次只执行 `draft` 并保存，恢复后只执行 `publish`，读回了原草稿。验证范围限于静态 Graph 中断与文件存储，不证明 ADK 动态审批、强杀恢复或远端操作的幂等行为。示例文件存储使用临时文件加 rename，未演示断电持久性、并发恢复与生产存储事务。

## 新请求怎样继续原任务？

第一次执行时传入 `adk.WithCheckPointID(taskID)`，应用消费事件迭代器，检查 `event.Err`，并从 `event.Action.Interrupted.InterruptContexts` 取得待审批信息与中断 ID。收到可信审批结果后，恢复入口用相同 taskID 加载记录，把决定送到对应中断点。

[[assets/eino-resume-approval.go|审批恢复接入片段]]依据 v0.9.14 API 编写，未独立编译或运行；由审批处理器调用，`runner` 已配置相同 Agent 与持久存储，两个 ID 来自先前中断记录，`approved` 已通过业务校验。返回的迭代器仍由调用方消费并处理事件错误。

[恢复实现](https://github.com/cloudwego/eino/blob/v0.9.14/adk/runner.go)先读取并解码检查点，将原状态与本次恢复数据放入运行上下文，再沿组件路径恢复。工具会重新进入执行函数，通过 `compose.GetInterruptState[T]` 读取之前保存的状态，通过 `compose.GetResumeContext[bool]` 判断自己是否是恢复目标及是否收到决定：未被选中或缺少决定就再次中断，拒绝则结束相应操作，同意才使用原草稿发布。

**恢复会重新执行中断的工具，不会从 `StatefulInterrupt` 后一行接着跑。** 所以发布等副作用必须放在恢复判断之后，不能在每次进入工具时无条件执行。`Runner.Resume` 的隐式恢复不携带逐项审批决定，不能直接替代上述审批入口。

## 配好存储后，是否就能应对任意退出？

不能把配置 Store 理解为每一步都会自动落盘。[Graph 手册](https://www.cloudwego.io/zh/docs/eino/core_modules/chain_and_graph_orchestration/checkpoint_interrupt/)提供节点前后断点、动态中断与外部主动中断；ADK Runner 在中断及特定受控取消路径保存。进程被强杀时未必有机会生成新检查点，只能利用此前已成功保存的记录。

存储写入失败必须作为错误处理；收到中断信息本身不足以证明落盘成功。新进程还要重建兼容的 Agent、工具和类型注册，检查点不会恢复进程的连接、锁或任意业务对象。自定义状态须可序列化，升级时也要核对旧记录兼容性。

应用仍负责审批权限、恢复请求的触发与并发控制，以及外部操作的幂等。远端发布成功而检查点尚未更新时，恢复依旧可能重复调用；框架保存执行位置并不提供业务操作「恰好一次」的保证。
