---
title: "OpenAI：Agent Token 计费与降本"
category: "Agent"
tags: ["Agent", "Token", "成本优化"]
learning_status: pending
created_at: "2026-10-21 17:16:57"
updated_at: "2026-10-21 17:16:57"
source:
  - "https://developers.openai.com/api/docs/guides/agents-api/observability#model-usage-and-cost"
  - "https://developers.openai.com/api/docs/guides/prompt-caching#monitor-cache-performance"
  - "https://developers.openai.com/api/docs/guides/cost-optimization"
  - "https://developers.openai.com/cookbook/examples/agent_optimization/optimizing_agents_for_cost_and_quality#monitoring-evals-and-guardrails"
---

**Agent 成本要按完整任务的实际调用累计，降本则要在质量达标的条件下比较完成任务的费用。** 本文节选 OpenAI 官方用量、缓存与优化文档中相关内容，核对于 2026-10-21；字段与缓存规则适用于对应 OpenAI 接口，不能直接套到所有供应商。

## 计费口径

[Model usage and cost](https://developers.openai.com/api/docs/guides/agents-api/observability#model-usage-and-cost)说明，一次 Agent 任务可能包含多次模型调用。输入包括指令、工具定义、历史、用户输入与工具结果；输出包括回复、工具调用参数与推理 Token。

通用计算方法是：**将一次调用的用量拆成互不重叠的计费类别，分别乘对应模型的单价，再累加全部调用。** 若单价按百万 Token 标示，计算时除以一百万；主 Agent、子 Agent 与重试产生的调用都要纳入。工具服务、沙箱计算与第三方费用另计。

[Understand token usage](https://developers.openai.com/api/docs/guides/agents-api/observability#understand-token-usage)中的 `cached_tokens` 已包含在 `input_tokens`，`reasoning_tokens` 已包含在 `output_tokens`，不能把明细再加到总数上。模型计数与费用是不同口径，不能用 `total_tokens` 乘统一价格。

[缓存用量文档](https://developers.openai.com/api/docs/guides/prompt-caching#monitor-cache-performance)还区分普通输入、缓存读取和缓存写入；支持独立写入计费的模型，须按写入类别及其价格计算，不能一律把未命中输入按普通输入价格算。若接口缺少所需明细，就不足以精确还原费用。Agents API 的会话／轮次 usage 可能暂缺或更新，缺失不代表零，也不等于最终账单。

## 降本从哪里入手

[Cost optimization](https://developers.openai.com/api/docs/guides/cost-optimization)提出三个直接方向：减少完成任务所需的请求、减少输入与输出 Token、选择准确性仍满足要求的小模型。它们分别改变调用次数、单次用量与单价。

[提示缓存](https://developers.openai.com/api/docs/guides/agents-api/observability#prompt-caching)复用匹配前缀的处理，仍会生成新回答；保留会话并不保证命中。稳定的初始指令和工具定义有助于复用，新增任务信息可放在后面。缓存输入仍收费，命中率高也不代表整任务费用低，须连同写入费用和调用次数检查。

具体改哪里，要先沿[[agent-trace|执行轨迹]]看模型输入、工具结果和重试原因。提示词去重、工具结果限量、确定性步骤交给程序等，是据这些机制形成的应用建议，收益须通过实际任务验证。

## 怎样确认降本有效

[官方客服 Agent 优化示例](https://developers.openai.com/cookbook/examples/agent_optimization/optimizing_agents_for_cost_and_quality#monitoring-evals-and-guardrails)建议检查完整轨迹，定位无效循环、错误动作和路由问题，再用同一代表性任务分布比较方案，先守住质量与正确性要求。

便宜模型若带来更多尝试、人工纠正和返工，每个成功结果反而可能更贵。原文因此采用「全部开销 ÷ 已核验的成功结果数」，分子包含失败尝试，并区分自主完成与人工协助完成。只衡量模型费用时，应明确称为「每成功任务的模型成本」；评估业务总成本时，再纳入工具、基础设施与人工等开销。

该示例以合成任务和确定性模拟演示方案比较，表格数字不能作为生产收益证明。实际效果需要自己的[[agent-evaluation|评测集]]与线上记录；本文未运行模型调用或核对账单。
