---
title: "Eino 子 Agent 的管理与通信"
parent: multi-agent-organization
category: "Agent"
tags: ["Agent", "多Agent协作", "Go", "Checkpoint"]
learning_status: pending
created_at: "2026-10-21 15:31:26"
updated_at: "2026-10-21 16:17:48"
source:
  - "https://github.com/cloudwego/eino-examples/tree/a6dbd95ab51fe9896a2bafa2e5a468e3bed01161/adk/multiagent"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/interface.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/agent_tool.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/flow.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/chatmodel.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/runctx.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/workflow.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/utils.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/internal/channel.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/prebuilt/supervisor/supervisor.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/deterministic_transfer.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/prebuilt/planexecute/plan_execute.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/prebuilt/deep/task_tool.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/compose/tool_node.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/react.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/wrappers.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/runner.go"
  - "https://github.com/cloudwego/eino/blob/v0.9.21/adk/interrupt.go"
---

**在 Eino 中，管理子 Agent 首先是管理一批 Go 对象；协作则是程序查找对象、调用它，再把结果交给后续模型调用。** 下面沿 DeepAgent 的一次任务追到底，再对比 Transfer、工作流和检查点。基于 **Eino v0.9.21** 静态源码；代码块是按真实函数压缩的 Go 风格伪代码，省略泛型、序列化细节及错误／中断分支，不能直接运行。

## 一次 task 调用，程序具体做了什么？

以主 Agent 委派一个代码检查任务为例。初始化时，[`typedNewTaskTool`](https://github.com/cloudwego/eino/blob/v0.9.21/adk/prebuilt/deep/task_tool.go)把已创建的成员包装成 AgentTool，存进 map；AgentTool 内部持有原 Agent 对象：

```text
主 Agent 的 task 工具
└─ subAgents: map[名称]工具
   ├─ "reviewer" → AgentTool{agent: 检查者对象}
   └─ "coder"    → AgentTool{agent: 编码者对象}
```

普通 ChatModelAgent 对象保存角色提示、模型客户端和工具配置。这里没有为每个角色启动常驻进程。`Info()` 把成员名称和能力描述提供给主模型，模型只负责生成类似下面的工具调用参数；它看不到 Go map，也不负责调用 Go 方法：

```json
{"subagent_type":"reviewer","description":"检查 counter++ 在多个 goroutine 中执行是否安全，返回风险与修改建议。"}
```

这是示意输入，不是运行日志。[`typedTaskTool.InvokableRun`](https://github.com/cloudwego/eino/blob/v0.9.21/adk/prebuilt/deep/task_tool.go)收到参数后，做的是查表和转发：

```go
func (t *taskTool) InvokableRun(ctx, args) string {
    in := decodeJSON(args)
    childTool := t.subAgents[in.SubagentType] // 找到已保存的对象
    childArgs := encodeJSON(map[string]string{
        "request": in.Description,
    })
    return childTool.InvokableRun(ctx, childArgs)
}
```

接下来进入 [`AgentTool.InvokableRun`](https://github.com/cloudwego/eino/blob/v0.9.21/adk/agent_tool.go)。它为**已有 Agent 的这一次执行**创建子 Runner，将 request 转成用户消息，然后持续收取子运行事件：

```go
func (at *agentTool) InvokableRun(ctx, args) string {
    request := decodeJSON(args).Request
    bridge := newBridgeStore() // 本次调用的临时检查点存储
    runner := NewRunner(Agent: at.agent, CheckPointStore: bridge)
    iter := runner.Run(ctx, []Message{UserMessage(request)},
        WithCheckPointID(bridgeCheckpointID), withSharedParentSession())

    var lastEvent *AgentEvent
    for {
        event, ok := iter.Next()
        if !ok { break }
        lastEvent = event
    }
    return messageText(lastEvent)
}
```

真实实现还会处理错误、流和中断：没有任何事件会报错，末事件没有消息时可能返回空字符串。它提取的是**末事件中的消息文本**，不会自动汇总所有中间步骤，也不保证结果符合某个业务结构。

子 Agent 内部可以多次调用模型和工具；外层 `InvokableRun` 消费它的事件，直到这次运行结束。事件由[内存队列](https://github.com/cloudwego/eino/blob/v0.9.21/internal/channel.go)承载。这里的 Spawn 指启动一次子运行，不能理解成每次重新创建 Agent 对象或操作系统进程。

**返回字符串还不等于父模型已经读到。** [父 ToolsNode](https://github.com/cloudwego/eino/blob/v0.9.21/compose/tool_node.go)把返回值包装为 `ToolMessage`，[ReAct 的 `afterToolCalls`](https://github.com/cloudwego/eino/blob/v0.9.21/adk/react.go)将它追加到父状态的消息数组，下一次模型调用才带上它：

```text
父 Messages 原有：用户需求、主模型发出的 task 工具调用
工具执行完后追加：ToolMessage(子结果，原 ToolCallID)
下一轮模型输入：上述 Messages → 主模型继续判断
```

因此，父模型生成工具调用后，本轮模型调用已经结束；是程序执行子任务、更新消息，再次调用父模型。开启中间事件展示可以让用户看见子过程，不能据此认为父模型实时读到了这些事件。以上为正常返回路径；配置直接返回的工具时，可以不再调用父模型。

## Transfer 和固定编排，程序哪里不同？

[Transfer 的 `flowAgent`](https://github.com/cloudwego/eino/blob/v0.9.21/adk/flow.go)持有 `subAgents []*flowAgent` 和 `parentAgent *flowAgent`，由 `SetSubAgents` 设置关系。它不是先得到子结果字符串，而是消费当前运行的转交动作，在当前 Agent 的子成员或父对象中按名查找，然后执行：

```go
// flowAgent.run：当前事件流结束并取得转交目的地后
next := a.getAgent(ctx, destName)
iter := next.Run(ctx, nil) // 输入从运行上下文重建
// 继续收取并向外转发 next 的事件
```

`transfer_to_agent` 只有目标名称，没有单独任务字段；`genAgentInput` 将原始需求和可见历史重建为输入，其他角色的消息会改写成 `For context: [角色] said: ...`。普通 [Supervisor](https://github.com/cloudwego/eino/blob/v0.9.21/adk/prebuilt/supervisor/supervisor.go)再为成员包装“正常完成后转回主管”的动作。它通常沿根 Runner 运行，不像 AgentTool 每次另建子 Runner。

[`workflowAgent`](https://github.com/cloudwego/eino/blob/v0.9.21/adk/workflow.go)也持有成员数组，但由程序固定调度：

| 模式 | 程序怎样调用 | 结果怎样继续使用 |
| --- | --- | --- |
| Sequential | 遍历成员，收完当前事件再启动下一位 | 下一位用原始输入与已累积历史重建输入 |
| Parallel | 先 fork 各分支上下文，再分别起 goroutine，最后 WaitGroup.Wait | 分支新增历史各存各的，全部结束后汇合 |
| Loop | 重复遍历成员数组 | 沿用历史；达到配置上限或收到 BreakLoop 等信号时停止，0 表示不限轮数 |

Parallel 的事件汇出是给外层收取，并非发给兄弟模型；执行中不会自动读到其他分支的新历史，普通错误也不会自动取消其余分支。[PlanExecute](https://github.com/cloudwego/eino/blob/v0.9.21/adk/prebuilt/planexecute/plan_execute.go)则把 Planner 接到 Executor／Replanner 循环，用会话值记录计划和执行结果，再取出生成下一次输入。

该版本已将 Transfer 和这些 Workflow API 标为不推荐，建议新实现考虑 AgentTool 或 DeepAgent。另外，嵌套流程会有历史隔离：项目管理示例的 Review 首次没有自动得到此前编码者输出，不能仅因注册了评审角色就认定完成了代码交接。

## 父子状态和 Checkpoint，是各存各的吗？

**AgentTool 的父子历史分开，会话值共享；检查点分层生成，再由外层统一保存。** 这三件事不能都叫“共享 session”。

| 数据 | AgentTool 父子之间的关系 |
| --- | --- |
| 用户输入、对话事件历史 | 子 Runner 新建自己的 RootInput 和事件历史；默认输入为 request，可选择传入父历史 |
| 会话键值 Values | 共享同一个 map 及其锁；值要经提示模板或输入生成函数进入上下文，模型才会看到 |
| 恢复用的检查点字节 | 子层先写临时 bridgeStore，再作为父工具的中断状态向上打包 |
| 业务文件、数据库和外部操作 | 由业务工具管理；Checkpoint 不自动备份文件或回滚外部操作 |

[`bridgeStore`](https://github.com/cloudwego/eino/blob/v0.9.21/adk/interrupt.go)内部是带锁的 `map[string][]byte`。每次 AgentTool 调用各建一个，所以内部使用同一个固定 checkpoint key，也不代表不同任务会互相覆盖。子 Agent 中断时，保存链是：

```text
子 Runner → 子检查点写入本次 bridgeStore
AgentTool → 取出子检查点 []byte，作为 CompositeInterrupt 的状态
父 ChatModelAgent → 连同自身 Graph 进度向上交付
根 Runner → 将整份运行记录编码，写入应用的 CheckPointStore[taskID]
```

根记录由 [`runnerSaveCheckPointImpl`](https://github.com/cloudwego/eino/blob/v0.9.21/adk/interrupt.go)用 gob 编码，包含 `RunCtx`、中断地址映射和组件状态映射；子检查点嵌在父工具的状态中。因此通常只需应用在**根 Runner 配置 CheckPointStore，并在运行时给出 WithCheckPointID**，不用给每个子 Agent 单独配置数据库。

恢复时，根 `Runner.Resume(taskID)` 读记录、定位中断工具；AgentTool 用 `GetInterruptState[[]byte]` 取回子快照，重建 bridgeStore 和子 Runner，再调用子 `Resume`。不需要原来的 goroutine 和临时 Store 对象继续存活，但恢复进程仍须重新构造相同的 Agent 定义与执行图。

Transfer／Workflow 通常由根 Runner 保存其运行与组件状态；顺序下标、循环轮次或并行分支进度随中断状态向上交付。如果应用把 Agent 分别作为独立根 Runner 启动，则需分别安排 checkpoint ID 和存储。

根 Store 没配置，就不会替应用持久保存整次运行；根 Store 也是内存实现时，跨进程仍不可恢复。这里描述的是框架支持的中断及取消保存路径，不代表每次模型调用后都自动落盘。共享 Values 的锁也只保护 map 操作，不能保护“读取—推理—写回”全过程或[[multi-agent-organization|共同修改的文件]]。
