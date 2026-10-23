---
title: "多 Agent 编排：官方模式对照"
parent: multi-agent-learning
category: "Agent"
tags: ["Agent", "多Agent协作", "工程选型"]
type: article
learning_status: pending
created_at: "2026-10-22 16:56:46"
updated_at: "2026-10-23 17:53:35"
source:
  - "https://adk.dev/workflows/patterns/"
  - "https://docs.langchain.com/oss/python/langgraph/workflows-agents"
  - "https://docs.langchain.com/oss/python/langgraph/graph-api#reducers"
  - "https://docs.langchain.com/oss/python/langgraph/errors/INVALID_CONCURRENT_GRAPH_UPDATE"
  - "https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/"
  - "https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/sequential"
  - "https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/concurrent"
  - "https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/handoff"
  - "https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/group-chat"
  - "https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/magentic"
---

**成熟框架按需要解决的协作问题提供模式，目录并没有统一为「有主管／无主管」。** 以下对照 Google ADK、LangGraph 与 Microsoft Agent Framework 的官方模式说明，说明各自强调什么、怎样组合。核对于 2026-10-22；未运行 SDK 示例，也未比较框架效果。

## Google ADK：分派、分解与反馈

[Workflow patterns](https://adk.dev/workflows/patterns/)列出协调与分派、顺序流水线、并行分发与汇合、层级任务分解、生成与评审、迭代改进、人工介入。它提供可实施的结构及示例，而非宣称这些类别互斥。

[Coordinator and dispatcher](https://adk.dev/workflows/patterns/#coordinator-and-dispatcher)让入口协调者选择专业成员，既可通过转交机制，也可显式调用包装成工具的 Agent。因此，父子配置本身不能说明控制权是转交还是返回。

[Hierarchical task decomposition](https://adk.dev/workflows/patterns/#hierarchical-task-decomposition)让中间层继续分派，成果逐层返回；[Generate and review](https://adk.dev/workflows/patterns/#generate-and-review-pattern)先生成再检查，[Iterative refinement](https://adk.dev/workflows/patterns/#iterative-refinement)则加入根据反馈修订和停止的循环。一次评审与反复改进应分别辨认。

这组材料适合从简单流程走到嵌套分工。它不证明增加层级或讨论轮数必然改善结果；具体实现仍需按项目任务验证。

## LangGraph：从固定依赖走向动态分工

[Workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents)依次解释 Prompt chaining、Parallelization、Routing、Orchestrator-worker、Evaluator-optimizer，再介绍自主 Agent，并提供图结构、状态与运行示例。

前三者分别处理前后依赖、可独立执行的分支、按输入选择处理路径。[Orchestrator-worker](https://docs.langchain.com/oss/python/langgraph/workflows-agents#orchestrator-worker)让协调者按具体任务动态形成子任务，区别于预先写好的固定并行分支；[Evaluator-optimizer](https://docs.langchain.com/oss/python/langgraph/workflows-agents#evaluator-optimizer)根据评价决定结束或带反馈重做，适合评价标准明确、反馈能指导改进的任务。

[Creating workers](https://docs.langchain.com/oss/python/langgraph/workflows-agents#creating-workers-in-langgraph)示例让各 worker 拥有独立状态，同时将产出的章节汇入共同的输出字段，协调图再读取并综合。这里共享的是约定的输出内容，不表示各 worker 自动看见彼此的完整运行历史。

[Reducers](https://docs.langchain.com/oss/python/langgraph/graph-api#reducers)说明字段可以配置更新函数，由旧值与本次增量计算新值，例如合并各分支提交的列表。[并发更新错误](https://docs.langchain.com/oss/python/langgraph/errors/INVALID_CONCURRENT_GRAPH_UPDATE)则说明：同一步中，多个节点更新一个没有合适合并规则的字段，可能触发 `INVALID_CONCURRENT_GRAPH_UPDATE`；需要明确该字段应怎样接收多个更新，不能把 LangGraph 描述为默认静默保留最后一份写入。

这类规则解决输出怎样保存和汇合，不会自动判断两个结论在事实层面是否矛盾；后者仍需要核对内容与依据。这是从字段更新机制得到的工程区分。共享状态与并发更新说明核对于 2026-10-23，未运行并发示例。

这些是流程模式，示例节点可以只是一次模型调用，不能因有多个节点就称为多 Agent。它们与 [[anthropic-effective-agents-summary|Anthropic 对工作流与自主决策的区分]]一致；在多 Agent 系统中，可以让不同 Agent 承担相应环节。

## Microsoft：顺序、并发、交接与群组协作

[Workflow orchestrations](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/)列出 Sequential、Concurrent、Handoff、Group Chat、Magentic 五类内置编排。

[Sequential](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/sequential)让后续成员消费前一步的信息；[Concurrent](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/concurrent)让成员独立处理同一输入并收集结果。前者用于有顺序依赖的阶段，后者用于可独立进行的多视角处理；并行结束后的汇总策略仍须明确。

[Handoff](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/handoff#differences-between-handoff-and-agent-as-tools)明确比较控制权归属：交接让接收者承担后续任务，Agent-as-tools 则由主 Agent 保持整体责任、等待子任务返回。路由到哪个成员与是否转移后续处理权，是需要分别回答的问题。

[Group Chat](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/group-chat)在共享会话中安排多轮贡献。其实现由中心协调者选择下一个发言者，策略可以是轮询、模型判断或自定义逻辑，并配置结束条件。**群组对话不等于无主管或对等去中心化**；应检查实际消息可见范围和发言选择机制。

[Magentic](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/magentic)面向路径未知的开放任务，由管理者根据进展和成员能力动态计划、分工及调整。官方说明它沿用 Group Chat 的架构，但管理者承担更强的计划职责；不能把它与一切主管模式视为同义词，也不能由其名称推断在所有任务上有效。

## 怎样对照不同目录

[[langchain-multi-agent|LangChain 的模式目录]]还包含单 Agent 的 Skills、Router 与可组合的 Custom workflow；[[multi-agent-study-sources#OpenAI Agents SDK：编排与控制权|OpenAI Agents SDK]]突出 Agents as tools 与 Handoffs。这些目录回答的范围不同，不能将其数量拼成一套统一标准。

综合这些资料，学习时可先理解任务依赖与分支，再认识持续协调、层级委派、交接和群组协作，最后检查反馈与停止条件。用「谁作下一步决定、谁得到哪些信息、谁负责最终结果」分析具体系统，比只记模式名称更能辨认实际行为。这是跨资料形成的阅读建议，不是任何一家文档规定的标准顺序。
