---
title: "通用 Agent 的澄清决策"
category: "Agent"
tags: ["Agent", "意图识别"]
learning_status: pending
created_at: "2026-10-21 20:21:55"
updated_at: "2026-10-21 20:21:55"
source:
  - "[REVOIR：Rational Clarification by Assistive Agents via Value-of-Information Reasoning，v1](https://arxiv.org/html/2609.37588v1)"
  - "[Anthropic：Trustworthy agents in practice](https://www.anthropic.com/research/trustworthy-agents)"
---

**通用 Agent 无法穷举用户意图，可以围绕当前请求动态形成解释，再比较追问与直接行动的预期效果。** 本文节选 REVOIR 的方法与局限，以及 Anthropic 对自主调查和澄清的讨论；不概括两份原文的全部内容。

## REVOIR：问题的价值取决于后续决策

REVOIR v1 发表于 2026-09-29。[§3.1–3.3](https://arxiv.org/html/2609.37588v1#S3)指出，自然语言意图空间无法穷举，单纯降低不确定性也未必改善任务结果：一个问题可能让模型知道更多，却不改变有用的回答或行动。

其方法在每轮进行以下处理：

1. 根据对话动态提出、保留或删去少量自然语言意图假设，按与对话的一致程度加权。
2. 生成候选问题与回应，模拟可能收到的回答；用模型代理评分估计不同假设下的任务效果。
3. 比较「问清后行动」与「现在行动」的价值，扣除交互成本，再选择问或做。若用户能在行动后纠正，也将这条反馈路径计入比较。

这里的信息价值（Value of Information，VoI）关注**信息能改善多少决策效果**，与只看意图分布的熵下降不同。模拟回答只用于估计收益，不能当成用户真实表达或授权。

原文[§5](https://arxiv.org/html/2609.37588v1#S5)保留了明确限制：使用一步前瞻和采样近似，意图假设与代理评分可能有误；尚未完整支持提问与非终止动作交错，也仍需真实用户部署验证。因此，可借鉴决策结构，不能把论文或一段提示词当作已经解决开放任务的通用判定器。此处不总结实验成绩。

## Anthropic：区分能调查的事实与用户的决定

2026-04-09 的文章在 [Helping agents understand their goals](https://www.anthropic.com/research/trustworthy-agents#helping-agents-understand-their-goals) 中将判断何时澄清称为尚未解决的难题：有些缺口能通过研究资料补足，有些目标与偏好只有用户能决定。对所有未知都暂停会削弱自主性，一律推进则会误解用户意图。

原文据此讨论训练与行为校准，没有提供覆盖所有任务的必填字段表或确定性算法。其讨论支持先识别缺口的来源，再决定调查还是询问；不能推出所有缺口都应转交用户。

## 转为提示词时能保留什么？

工程上可将上述思路压缩为「**当前假设 → 不同回答对方案的影响 → 猜错损失与提问成本 → 问或做**」。这些内容由模型针对当前任务动态形成，不是事先枚举业务动作。提示词可以要求简短记录关键假设、预计改变的决策及问或做的理由；这是对方法的简化应用，未实测其效果，也不等同于复现论文的采样与评分算法。
