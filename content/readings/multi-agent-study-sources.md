---
title: "多 Agent 学习选读：编排术语、源码与工程经验"
parent: multi-agent-orchestration
category: "Agent"
tags: ["Agent", "多Agent协作", "工程选型"]
type: article
learning_status: pending
created_at: "2026-10-22 12:01:49"
updated_at: "2026-10-22 17:01:35"
source:
  - "https://openai.github.io/openai-agents-python/multi_agent/"
  - "https://developers.openai.com/api/docs/guides/agents/orchestration"
  - "https://learn.chatgpt.com/docs/agent-configuration/subagents"
  - "https://learn.chatgpt.com/docs/environments/cloud-environments"
  - "https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/core/src/tools/handlers/multi_agents/spawn.rs"
  - "https://github.com/huggingface/smolagents/blob/main/docs/source/en/examples/multiagents.md"
  - "https://github.com/huggingface/smolagents/blob/main/src/smolagents/agents.py"
  - "https://arxiv.org/html/2512.08296v3"
  - "https://cognition.com/blog/multi-agents-working"
---

**这些材料分别解释编排与委派的术语、一次委派怎样执行、协作收益为何依赖任务，以及编程系统怎样约束协作。** 以下按学习问题节选，未总结各框架的全部能力；核对于 2026-10-22，未运行产品流程、示例或复现实验。

## OpenAI Agents SDK：编排与控制权

[Agent orchestration](https://openai.github.io/openai-agents-python/multi_agent/)将 orchestration 定义为应用中 Agent 的运行流程：哪些 Agent 运行、顺序如何、下一步怎样决定。它区分模型决定步骤与代码规定步骤，并允许组合；代码编排的示例包括分类路由、顺序处理、评估循环和并行调用。因此，讨论整个协作流程时，「编排」比只突出执行时机的「调度」更贴合此处的原词。这是本文的用语选择，不表示所有文档都有统一的中文译法。

[Core SDK patterns](https://openai.github.io/openai-agents-python/multi_agent/#core-sdk-patterns)比较 Agents as tools 与 Handoffs：前者由 manager 保持会话控制权，通过 `Agent.as_tool()` 调用专家并整合成果；后者让专家成为当前 turn 剩余部分的执行者。两者可以嵌套组合，不能由一种模式推断整个系统只能采用集中或对等结构。

[Orchestration and handoffs](https://developers.openai.com/api/docs/guides/agents/orchestration#choose-the-orchestration-pattern)同样以「谁负责最终面向用户的回答」区分这两种模式，并用 delegated ownership 描述 handoff。可据此区分调用后返回与转交控制权，但不宜把 delegation 限定为前者。跨框架对照时，应核对控制流与结果归属，不能仅按名称判断等价。

## Codex：子 Agent 与云端任务

[Subagents 的 Core terms](https://learn.chatgpt.com/docs/agent-configuration/subagents#core-terms)将 subagent 定义为 Codex 启动、接受委派并处理特定任务的 Agent，将 agent thread 定义为它工作的线程。[Orchestration and thread controls](https://learn.chatgpt.com/docs/agent-configuration/subagents#orchestration-and-thread-controls)把创建、后续指令路由、等待结果和关闭线程归入 orchestration；主会话收集分支结果并汇总。该文使用 main agent、parent agent 与 subagent，不要求把主 Agent 命名为 Supervisor。

固定在提交 `ce0323f2f2d3b25e82806cd555237da3db4e1897` 的 [V1 创建入口](https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/core/src/tools/handlers/multi_agents/spawn.rs#L111-L138)在准备子配置后调用运行服务，并将当前线程写入 `parent_thread_id`。这支持把父子理解为相对创建关系。该入口还传入已有的 environments；单凭创建子线程，不能推断另建了云端环境、操作系统进程或独立沙盒。这是一个已固定版本的实现片段，不是所有客户端行为的保证。

[Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments)将云端环境描述为可复用的仓库、依赖、工具和访问设置，每个新任务从发布的环境取得自己的隔离工作区；[已有任务保留自身保存状态](https://learn.chatgpt.com/docs/environments/cloud-environments#reuse-and-update-saved-state)。因此应分别描述运行位置、工作区隔离与主／子 Agent 协作关系：同时运行多个云端任务，不能单独证明它们构成父子委派。这里的「因此」是对两组文档的归纳；所查页面不足以断言每个 Cloud task 必然或绝不使用子 Agent。

## smolagents：看清一次真实委派

[官方最小示例](https://github.com/huggingface/smolagents/blob/main/docs/source/en/examples/multiagents.md)创建两个执行单元：搜索者是 ToolCallingAgent，使用搜索工具及通过 HTTP 读取网页的工具；主管是 CodeAgent，通过 `managed_agents` 注册搜索者。子 Agent 的名称和描述帮助主管知道何时调用它，工具集则决定各自能执行哪些动作。

沿 [agents.py](https://github.com/huggingface/smolagents/blob/main/src/smolagents/agents.py) 的 `_setup_managed_agents`、`run`、`CodeAgent._step_stream` 和 `MultiStepAgent.__call__`，可以追踪完整路径：注册子 Agent → 父模型生成调用代码 → Python executor 调用子对象 → 子 `run` 执行搜索与读取 → 包装成果返回父执行过程。子内部再通过 `ToolCallingAgent.execute_tool_call` 执行工具。

这里父层通过生成代码调用子 Agent，不能把父层也画成 ToolCallingAgent 的工具执行路径。源码阅读应分别记录父子实际输入、动作和结果，确认返回内容何时进入父下一轮判断。

**选材价值与边界：** 真实搜索和网页读取让任务受外部结果影响，适合学习层级委派；示例没有证明并行协作、跨进程通信或多 Agent 相对单 Agent 的收益。CodeAgent 还引入本地代码执行，阅读时须分清代码执行器与协作本身。以上链接为滚动 main；进入可复现实验前需要固定提交和依赖。

## Google：协作效果取决于任务和开销

[《Towards a Science of Scaling Agent Systems》v3](https://arxiv.org/html/2512.08296v3)在六类基准、260 个配置中比较单 Agent 及四类多 Agent 架构，控制工具、任务提示与计算预算，观察最终表现、协调开销和错误传播。

[§3.1 的架构定义](https://arxiv.org/html/2512.08296v3#S3.SS1)区分了成员之间如何通信：Independent 架构的成员不互相通信，只将输出交给最终汇总者；Centralized 通过主管协调；Decentralized 允许无主管的对等信息交换；Hybrid 结合集中协调与成员间通信。该实验的 Independent 进一步限定为只拼接输出，不分析比较、交叉核验或投票；不能直接等同于所有带综合判断的并行汇总。因此，分支独立运行仍可以通过成果汇合共同完成任务，成员彼此聊天或拥有固定主管都不是所有架构的必要条件。这是论文中用于对照的架构划分，不是对全部多 Agent 系统的穷举。

结果随任务而变化：Finance Agent 中，集中协调的平均指标为 0.631，单 Agent 为 0.349，相对提升约 80.8%；PlanCraft 中，多 Agent 各架构相对单 Agent 下降约 39%—70%。这些是该论文配置下的相对变化，不能当作其他任务的收益预测。

作者把这种差异联系到信息整合与探索多样性的取舍：成员能独立探索，但全局信息须经消息传递，带来遗漏、同步和协调成本。增加成员与消息并不自动提高最终质量。

这支持先定义任务与单 Agent 对照，再检验拆分是否有效。它没有证明某种拓扑普遍最优：SWE-bench 和 Terminal-Bench 每配置仅取 20 个实例，提示没有按每种架构分别优化；部分协调效应在稳健性分析中只保留为方向性线索。论文中的选型预测也不能当作对任意新任务的保证。

## Cognition：单一写入者与独立判断

[2026-04-22 的工程文章](https://cognition.com/blog/multi-agents-working)更新了作者此前对多 Agent 的笼统反对，报告了一类较窄的有效实践：**保持主要写入与决策集中，让其他 Agent 提供审查或咨询。** 多个并行写入者可能各自作出隐含的风格、边界和设计决定，最终相互冲突。

在代码审查循环中，reviewer 从改动出发重新调查，不继承编写者的整段推理历史；编写者再结合用户要求和已有决定筛选审查意见。关键不只是独立检查，还包括把意见接回整体任务，避免无止境返工、越界或违背用户意图。

文章同时保留失败经验：让较弱的 SWE-1.5 主模型按需咨询 Sonnet 4.5，虽然有成本和速度收益，质量仍未达到目标，因为主模型不善于判断何时求助以及该问什么。多模型组合本身不能补齐委派判断。

作者也报告了在多个强模型间，按调试、视觉推理、测试等子任务匹配各自能力的有效经验。这支持按任务选择执行者的设计动机，并未提供质量或费用必然改善的保证。

这是产品维护方的经验报告，缺少足够公开的统一对照，不能据此断言独立 reviewer 必然有效。其学习价值是提出可检验的设计：谁能写入、审查者看什么、谁采纳建议，以及何时结束循环。
