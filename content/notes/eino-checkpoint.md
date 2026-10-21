---
title: "Eino Checkpoint 的保存与恢复"
parent: agent-checkpoint-recovery
category: "Agent"
tags: ["Agent", "Checkpoint", "持久化", "Go"]
learning_status: pending
created_at: "2026-10-19 20:16:24"
updated_at: "2026-10-19 20:24:07"
learning_status_changed_at: "2026-10-19 20:34:03.295"
---

**Eino 的 Checkpoint 是一份可持久化的运行快照；Graph 根据其中的节点键、节点输入和组件状态重建待执行任务。** 恢复程序不需要猜测聊天记录意味着什么，也不依赖原进程的代码行号。

这里聚焦一个问题：Checkpoint 中的什么值，能让程序识别「接着调用模型」或「接着执行工具」？以下依据[[eino-checkpoints#节点键与待执行任务|Eino v0.9.14 的源码与保存实验]]，先讲 Graph 的恢复，再解释它在 ChatModelAgent 内怎样使用。

## 节点名为什么能定位代码？

构建 Graph 时，每个节点都用一个字符串键注册对应的执行逻辑。例如，ChatModelAgent 的 ReAct 图在 `adk/react.go` 中注册了 `ChatModel`、`ToolNode` 等节点：前者关联模型调用，后者关联工具执行。

编译 Graph 时，`compose/graph.go` 把这些节点组织成 `chanSubscribeTo` 映射。**「节点键 → 已编译执行对象」的对应关系，由程序构建图时确定。** 所以，Checkpoint 不需要保存函数地址；新进程重新构建兼容的图，就能用同一个键查回相应执行对象。

这里的 `CheckPointID` 只用于从存储取出整份快照；决定接着执行哪个节点的是快照中的节点键。它们解决的是不同层次的定位问题。

## Checkpoint 怎样记录待执行节点？

`compose/checkpoint.go` 中的核心字段之一是 `Inputs map[string]any`。它将**「待执行节点的键」与「交给该节点的输入」**保存在一起。

静态中断时，`handleInterrupt` 已经拿到下一批待执行任务 `nextTasks`。它逐个取出任务的 `nodeKey` 和 `input`，写入 `cp.Inputs`，再保存图状态与调度信息，序列化后调用 Store 的 `Set`。因此，保存的是已经算好的后续任务，不是让模型写一句「下一步调用工具」。

[[assets/eino-checkpoint-saved.json|实际保存的检查点]]来自一个 `draft → publish` 图：`draft` 完成后，在 `publish` 前中断。解码后，`Inputs` 的键是 `publish`，对应值是先前生成的草稿；`State` 也保留了该次执行的业务状态。文件中的 `Type`、`MapValues`、`JSONValue` 是默认序列化器的类型包装，不是额外的执行阶段。

![[assets/eino-checkpoint-node-lookup.png|640]]

## 读回后，程序怎样开始执行？

恢复入口读取并反序列化快照后，先恢复图状态与 Channels，再调用 `restoreTasks`。[[assets/eino-checkpoint-source.txt|官方源码节选]]保留了这个完整函数及相关状态结构；它属于框架内部代码，不能单独编译。

`restoreTasks` 遍历 `Inputs`：拿键去查 `r.chanSubscribeTo[key]`，把查到的执行对象和保存的输入重新组装成 task，交给原有调度器执行。找不到对应节点时会报错。需要重跑的节点若只在 `RerunNodes` 中，函数会先补上该节点的零值／空流输入，再创建任务；组件需要的原始局部输入可由自身的中断状态恢复。

**「节点键查回执行对象，保存的输入交给该对象」**，两者一起组成恢复后的任务。[[assets/eino-checkpoint-demo.go|无模型 Go 示例]]已在两个独立进程中验证：恢复只运行 `publish`，不会先从 `draft` 重跑。

## 怎样区分接着调用模型还是工具？

以在相应节点前设置静态断点为例，程序能够直接根据保存的节点键作出区分：

| 保存位置 | 恢复时识别的节点键 | 后续动作 |
| --- | --- | --- |
| 模型已返回，准备进入工具节点 | `ToolNode` | 进入工具节点，使用已确定的工具调用请求 |
| 工具结果与相关处理已完成，准备再次调用模型 | `ChatModel` | 进入模型节点，使用恢复的输入和图状态继续调用 |

这不是 Eino 额外保存了一个统一的 `phase` 枚举；**「模型调用和工具执行本来就是不同的图节点」**，节点键已经表达这层执行位置。`adk/react.go` 的实际图还有 `CancelCheck`、`AfterToolCalls` 等中间节点；若中断在那里，就恢复那个节点，不能一律跳过它们直接调用模型或工具。

## 工具只完成了一部分，保存什么？

Graph 只能定位到 `ToolNode`，而一个 ToolNode 中可能有多个工具调用。Eino 在这一层再保存 `toolsInterruptAndRerunState`：

- **「Input」**：原模型消息，包含本批工具调用的名称、参数和调用 ID。
- **「ExecutedTools」**：已成功执行的普通工具，以调用 ID 映射到结果；增强工具另有 `ExecutedEnhancedTools`。
- **「RerunTools」**：需要重新进入的工具调用 ID。

ToolsNode 通过 `CompositeInterrupt` 带出这些组件状态；Graph 保存需要重进的工具节点及对应状态。下面以 A 完成、B 中断为例，`Input` 中简写了调用 ID，实际原消息还包含工具名与参数。

![[assets/eino-checkpoint-tool-resume.png|640]]

**「重进工具节点，不等于重新执行这一批所有工具」**。源码中，`genToolCallTasks` 按调用 ID 匹配已完成结果，把命中的任务标为 `executed=true`；执行函数遇到这个标记就跳过调用，直接复用结果。

这里描述的是框架能收集并保存中断状态的路径，不代表任意崩溃都已经留下这份记录；部分工具中断路径仅核对源码，未单独运行实验。

## 两层快照怎样配合，有什么边界？

Graph 的其他字段继续支撑调度：`RerunNodes` 记录需重跑的节点，`Channels` 保留通道及依赖进度，`SubGraphs` 保存嵌套图快照，`SkipPreHandler` 控制恢复时是否跳过节点前置处理；中断地址与组件状态映射用于重新进入对应组件。它们按具体中断情形配合，不能只把 `Inputs` 当作所有场景的完整检查点。

ChatModelAgent 将内部 Graph 检查点字节通过桥接存储带到 ADK；Runner 外层再把运行上下文、中断地址和组件状态等用 gob 保存。恢复时先定位 Agent／组件，再让内部 Graph 重建任务。前面的静态实验验证了 Graph 层，未验证完整的嵌套 Agent 恢复链路。

Eino 也没有默认在每个模型或工具完成后自动生成持久检查点：需要静态断点、动态中断或框架支持的受控取消路径。**「恢复依赖此前成功保存的快照」**；外部操作已经成功、本地却没保存结果时，仍需查询或按远端幂等约定处理，框架不能恢复到任意函数的下一行。
