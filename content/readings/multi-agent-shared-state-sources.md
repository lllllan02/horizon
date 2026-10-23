---
title: "LangGraph 与 ADK：共享状态的更新与可见性"
parent: multi-agent-shared-state
category: "Agent"
tags: ["Agent", "多Agent协作", "状态管理"]
learning_status: pending
created_at: "2026-10-23 19:50:51"
updated_at: "2026-10-23 20:07:59"
source:
  - "https://docs.langchain.com/oss/python/langgraph/graph-api"
  - "https://docs.langchain.com/oss/python/langgraph/pregel"
  - "https://docs.langchain.com/oss/python/langgraph/workflows-agents"
  - "https://docs.langchain.com/oss/python/langgraph/errors/INVALID_CONCURRENT_GRAPH_UPDATE"
  - "https://docs.langchain.com/oss/python/langgraph/interrupts"
  - "https://adk.dev/agents/workflow-agents/loop-agents/"
  - "https://adk.dev/sessions/state/"
  - "https://adk.dev/agents/workflow-agents/sequential-agents/"
  - "https://adk.dev/agents/workflow-agents/parallel-agents/"
---

**LangGraph 把节点增量按步骤合并，ADK 把约定输出写入会话状态，再在后续请求中读取。** 本篇核对官方文档和维护方源码，聚焦共享字段、应用更新、读取时机及并发边界；不比较框架效果，也不把运行内状态与跨运行存储混为一谈。

## LangGraph：返回增量，步末合并

[Graph API 的 State 与 Reducers](https://docs.langchain.com/oss/python/langgraph/graph-api#state)规定节点接收状态、返回局部更新，字段可声明自己的合并函数。未声明 reducer 的普通字段采用替换语义；[同一步多个节点更新该字段](https://docs.langchain.com/oss/python/langgraph/errors/INVALID_CONCURRENT_GRAPH_UPDATE)会报 `INVALID_CONCURRENT_GRAPH_UPDATE`，不能概括为默认保留最后写入。

[官方 worker 示例](https://docs.langchain.com/oss/python/langgraph/workflows-agents#creating-workers-in-langgraph)让各 worker 接收各自的 `section`，调用模型生成章节，然后返回 `{"completed_sections": [section.content]}`。共享字段使用 `Annotated[list, operator.add]` 累积章节。图随后安排 `synthesizer` 读取列表并拼接报告；这个汇总函数只是字符串拼接，没有再次调用模型。需要后续模型使用状态时，同页 Agents 示例中的节点显式将 `state["messages"]` 交给模型调用，不能省略输入组装。

![[assets/multi-agent-shared-state-runtime.png|640]]

[Pregel 的三个阶段](https://docs.langchain.com/oss/python/langgraph/pregel#overview)是计划、并行执行、应用更新。本步产生的更新在执行阶段不可见，下一步才可读；节点是否执行仍取决于图的边、条件与调度，不是任意字段变化都会唤醒所有 Agent。同一步并行的 worker 因而不能依赖彼此本步的新结果。

源码固定到 [1.2.16 的提交 `9d68e5b3`](https://github.com/langchain-ai/langgraph/commit/9d68e5b3eb1a63027b05e9f0152149ea0284dcdb)：

- [`StateGraph` 与局部更新提取](https://github.com/langchain-ai/langgraph/blob/9d68e5b3eb1a63027b05e9f0152149ea0284dcdb/libs/langgraph/langgraph/graph/state.py#L1456)：提取声明字段的更新，并按节点输入 schema 组织输入。不能由“快照”推导出任意嵌套 Python 对象都已深拷贝，节点应遵守返回更新的契约。
- [`Pregel.stream` 主循环](https://github.com/langchain-ai/langgraph/blob/9d68e5b3eb1a63027b05e9f0152149ea0284dcdb/libs/langgraph/langgraph/pregel/main.py#L3050)与[`after_tick`](https://github.com/langchain-ai/langgraph/blob/9d68e5b3eb1a63027b05e9f0152149ea0284dcdb/libs/langgraph/langgraph/pregel/_loop.py#L737)：本步执行结束后应用更新，再准备后续节点。
- [`apply_writes`](https://github.com/langchain-ai/langgraph/blob/9d68e5b3eb1a63027b05e9f0152149ea0284dcdb/libs/langgraph/langgraph/pregel/_algo.py#L293)按字段收集更新；[`LastValue.update`](https://github.com/langchain-ai/langgraph/blob/9d68e5b3eb1a63027b05e9f0152149ea0284dcdb/libs/langgraph/langgraph/channels/last_value.py#L56)拒绝同一步多个值；[`BinaryOperatorAggregate.update`](https://github.com/langchain-ai/langgraph/blob/9d68e5b3eb1a63027b05e9f0152149ea0284dcdb/libs/langgraph/langgraph/channels/binop.py#L127)调用 reducer。

列表拼接只保留各份内容，不核验结论真假；内部渠道版本也不能直接当作业务提案的版本条件提交。持久化另见[[langgraph-checkpoints|检查点机制]]。

## ADK：事件更新状态，构建请求时读取

[State 文档](https://adk.dev/sessions/state/)将 `session.state` 定义为键值数据。普通对话模式下，`LlmAgent.output_key` 将最终输出交给状态更新流程；工具也可通过 Context 的状态接口提出修改。`instruction` 中的 `{key}` 在构建模型请求时由程序替换为当前值，保存状态不会改写已经发出的请求。

[串行代码生成示例](https://adk.dev/agents/workflow-agents/sequential-agents/)中，CodeWriter 使用 `output_key="generated_code"`，后续 CodeReviewer 的提示引用 `{generated_code}`。[并行研究示例](https://adk.dev/agents/workflow-agents/parallel-agents/#full-example-parallel-web-research)则给三名研究员分别配置独立输出键，全部完成后再让汇总成员读取三个键。这里的可见时机由流程依赖与请求构建决定，不需要在这条工作流里另加定时轮询。

源码固定到 **ADK Python v2.9.0**：

- [`LlmAgent.__maybe_save_output_to_state`](https://github.com/google/adk-python/blob/v2.9.0/src/google/adk/agents/llm_agent.py#L961)把输出放入 `event.actions.state_delta[output_key]`；[`Runner`](https://github.com/google/adk-python/blob/v2.9.0/src/google/adk/runners.py#L1323)调用 SessionService 的 `append_event`，由其应用或持久化增量。task 模式另走 `finish_task`，这里不推广到所有运行模式。
- [`BaseSessionService._update_session_state`](https://github.com/google/adk-python/blob/v2.9.0/src/google/adk/sessions/base_session_service.py#L203)逐键应用增量；[`instructions`](https://github.com/google/adk-python/blob/v2.9.0/src/google/adk/flows/llm_flows/instructions.py#L65)调用 `inject_session_state`，将实际内容放进模型请求。
- [`State.__setitem__`](https://github.com/google/adk-python/blob/v2.9.0/src/google/adk/sessions/state.py#L83)同时更新 Context 关联的当前值和事件增量，不能称为提交前完全隔离的状态副本。

### ADK 的并发边界

[`ParallelAgent` 源码](https://github.com/google/adk-python/blob/v2.9.0/src/google/adk/agents/parallel_agent.py#L222)说明分支对话历史隔离，而 `session.state` 仍共享，同键写入保留最后值。因此，独立 `output_key` 是应用划分写入归属，不是自动解决了任意同键冲突。Parallel 文档中“分支无自动 state 共享”的概括与其完整例子及当前源码不一致，本文按固定版本源码解释。

[`DatabaseSessionService.append_event`](https://github.com/google/adk-python/blob/v2.9.0/src/google/adk/sessions/database_session_service.py#L802)另有会话锁、受支持数据库的行锁及旧存储版本检测；[过时会话检查](https://github.com/google/adk-python/blob/v2.9.0/src/google/adk/sessions/database_session_service.py#L872)会抛出 `StaleSessionError`。这是保存会话的协调机制，不能据此宣称同一次 Session 内任意并行语义修改都安全，也不能概括为 ADK 完全没有冲突检测。

该版本的 `SequentialAgent`、`ParallelAgent` 模板类已弃用，官方建议 2.0+ Workflow。本文用其仍可核对的官方例子解释状态交接，不将模板类作为新项目选型推荐，未展开 Workflow 迁移。

## 收集结果以后，怎样核验与采纳

reducer 是运行时调用的字段合并函数。[固定版本的实现](https://github.com/langchain-ai/langgraph/blob/9d68e5b3eb1a63027b05e9f0152149ea0284dcdb/libs/langgraph/langgraph/channels/binop.py#L127)只把旧值与本次更新交给配置的运算函数；`operator.add` 可以同时保存两份互相矛盾的文本，不会因此完成内容仲裁。它没有主管 Agent 的任务分配与持续决策职责。

[LangGraph evaluator–optimizer](https://docs.langchain.com/oss/python/langgraph/workflows-agents#evaluator-optimizer)示例让评价节点返回评价与反馈，条件分支据此结束或回到生成节点；示例检查笑话是否有趣，并未实现研究证据的事实核验。[Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts#pause-using-interrupt)可携带问题暂停，配合 checkpointer 和同一线程的 `Command(resume=...)` 接回外部决定。这些机制提供核验、修订和人审的控制入口，不提供自动正确的裁决。

[ADK 文稿改进示例](https://adk.dev/agents/workflow-agents/loop-agents/#full-example-iterative-document-improvement)更明确地区分职责：CriticAgent 读取 `current_document`，按提示中规定的句数、结构和细节要求检查，将反馈写到 `criticism`；RefinerAgent 读取文稿和反馈，修改后写回，或者调用 `exit_loop`。这些要求由模型判断，示例没有独立事实验证程序。

[固定版本 LoopAgent](https://github.com/google/adk-python/blob/v2.9.0/src/google/adk/agents/loop_agent.py#L74)只按 `actions.escalate` 信号或次数上限结束，不理解批评内容。官方例子配置最多 5 轮，次数耗尽也会停止，所以不能将停止等同于通过。该模板同样已弃用，适用范围沿用前文说明。

将这些机制用于互相矛盾的研究成果时，应用还需规定：保留候选的对象、条件与出处；重复内容怎样去重；同条件下的矛盾怎样补查或验证；无法判断时如何标记未决或转人审；只有符合采纳条件的内容进入最终结果。这是依据上述控制机制提出的应用设计，不是框架自带的事实裁决器。

核验可以由固定程序安排，也可由成员交叉复核，不要求另设负责派活的主管 Agent。没有主管不等于没有数据更新、结果采纳与结束规则；成员达成一致本身也不证明结论正确。

官方页面与源码核对于 2026-10-23。未运行模型、SDK 示例、并发写入或恢复实验；跨框架的解释与条件性建议是基于这些机制的归纳。
