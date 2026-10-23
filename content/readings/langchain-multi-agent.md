---
title: "LangChain：子 Agent、交接与路由的分工"
parent: multi-agent-orchestration
category: "Agent"
tags: ["Agent", "多Agent协作", "工程选型"]
created_at: "2026-10-13 17:41:05"
updated_at: "2026-10-22 15:16:00"
source: ["https://docs.langchain.com/oss/python/langchain/multi-agent/index", "https://docs.langchain.com/oss/python/langchain/multi-agent/subagents", "https://docs.langchain.com/oss/python/langchain/multi-agent/router", "https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs", "https://docs.langchain.com/oss/python/langchain/multi-agent/custom-workflow", "https://docs.langchain.com/oss/python/langchain/multi-agent/skills"]
learning_status: pending
---

LangChain 用控制权和上下文组织区分协作模式：主 Agent 委派并汇总，路由先分类，交接让后续处理者接续对话，工作流还可以把这些方式组合起来。以下节选官方总览、Subagents、Router、Handoffs、Custom workflow 与 Skills；核对于 2026-10-22，未运行 SDK 示例。

## 为什么分成这些模式？

[总览](https://docs.langchain.com/oss/python/langchain/multi-agent/index)提出三类需求：控制每个执行者接收的信息、让不同团队独立维护能力、并行推进任务。不同领域还可以配置专用指令与工具，通过可调用的子 Agent 组合能力。

这些组织收益并非多 Agent 独有：[Skills](https://docs.langchain.com/oss/python/langchain/multi-agent/skills)也支持单 Agent 按需加载专业能力，由不同团队独立维护，并可扩展动态工具注册。只有提示或知识不同，不一定需要多个 Agent；步骤固定时，也可由工作流组合确定性逻辑与 Agent 节点。

## 怎样选择？

[Router 的模式比较](https://docs.langchain.com/oss/python/langchain/multi-agent/router#stateless)区分持续统筹与预先分类：主从模式由保留会话上下文的主 Agent 根据进展动态调用子 Agent，适合下一步随中间结果变化的多步任务；路由适合输入类别与专业领域边界明确的请求，由专门步骤分类后分发。路由可以选一个执行者，也可并行选择多个后汇总，不限于单选。需要多轮会话时可为路由维护状态，或将其包装为会话 Agent 的工具。

[Handoffs 的适用条件](https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs#when-to-use)包括跨阶段直接与用户交互，以及满足前置条件后解锁后续能力。接手角色或状态持续处理后续消息，适合需要接续对话的阶段转换。

## 具体怎样实现？

[Subagents](https://docs.langchain.com/oss/python/langchain/multi-agent/subagents)把集中协调的主 Agent 称为 supervisor，由它决定调用谁、传入什么以及如何合并结果。子 Agent 被包装成工具：接收任务，调用子运行，再提取成果返回主 Agent。专家可以各自暴露工具，也可共用按名称分发的入口。主管可串行调用，也可并行分派独立子任务；委派关系本身不规定任务是否同时执行。传入查询、选定历史或完整上下文，以及返回成果还是更多历史，决定隔离程度。有依赖就等待；后台执行则需另行管理运行和结果回收。

基础示例先创建研究 Agent，再在工具函数中用 `subagent.invoke(...)` 传入任务，最后取出末条消息返回。主管调用这个工具后，取得的是工具函数选出的成果，不会自动取得研究者的全部内部历史。示例中的主管和研究者使用相同模型；职责与子运行的分离不要求更换模型。

在这种集中委派结构中，多个子 Agent 各自向主管返回成果；同属一个主管不代表成员之间自动通信，直接交换信息需要额外安排。

[Single dispatch tool](https://docs.langchain.com/oss/python/langchain/multi-agent/subagents#single-dispatch-tool)还说明，即使子 Agent 与主管拥有相同能力，也可以通过单独上下文处理复杂分支、只返回简要成果，避免主管历史持续膨胀。隔离同时带来信息边界：主管只能依据实际返回的内容继续判断，必要条件或结果未被返回时，仍可能遗漏信息。

[Handoffs](https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs)通过工具更新 `active_agent` 或 `current_step`，程序据此切换节点或调整同一个 Agent 的提示与工具。因此，交接不一定创建新 Agent。转交历史时，工具调用与对应结果应成对保留，避免消息历史不合法。

交接改变的是后续处理的路由，不要求销毁原 Agent 或结束进程。传递哪些任务信息和历史由应用选择，也不表示自动复制全部上下文。

## 固定步骤怎样与 Agent 组合？

[Custom workflow](https://docs.langchain.com/oss/python/langchain/multi-agent/custom-workflow)把外层顺序、分支、循环与并行关系交给程序定义，节点可以是普通函数、一次模型调用或带工具的完整 Agent，也可以嵌入其他协作模式。

原文的 RAG 示例把流程分成查询改写、向量检索与回答三个节点：检索由确定性代码执行，回答节点内部的 Agent 仍可调用工具取得额外信息。外层流程固定与节点内部动态选择可以同时存在，不能仅因流程中出现模型或 Agent，就认为整个执行顺序都由模型决定。

这组文档解释框架内的控制流；业务授权、跨服务协议和最终验收仍由应用定义。
