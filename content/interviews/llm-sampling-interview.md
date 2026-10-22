---
title: "Temperature、Top K、Top P 是什么，有什么区别？"
aliases: ["大模型采样参数", "温度参数", "Temperature", "Top-K", "Top-P"]
category: "大模型"
parent: interview-hub
tags: ["面试"]
learning_status: organized
created_at: "2026-10-22 13:14:00"
updated_at: "2026-10-22 13:22:30"
learning_status_changed_at: "2026-10-22 14:23:41.043"
---

这三个都是控制大模型生成下一个 token（文本片段）时如何[[llm-sampling-sources|采样的参数]]，用来调节输出的稳定性和多样性。**Temperature 调整概率分布，Top K 和 Top P 筛选候选范围**。

**Temperature（温度）控制概率分布的集中程度**。启用随机采样且温度大于 0 时，[[llm-reproducibility-sources#零温度与贪心解码|温度缩放]]会把模型给候选 token 的分数（logits）除以温度，再经 softmax 转成概率。温度低于 1，概率更集中，更倾向于选高分候选；高于 1，分布更平缓，输出更多样；等于 1 时保持原分布。低温并不保证答案更正确。

温度为 0 时需看接口约定，支持这一用法的服务通常每步选最高分 token，但[[temperature-zero-interview|零温度仍不能单独保证整段输出完全一致]]。

**Top K 按数量筛选**：只保留概率最高的 K 个候选，再在这些候选里按概率抽取。例如 K 为 3，就只从概率最高的三个 token 里选。

**Top P 按累计概率筛选**：先按概率从高到低排列，保留累计概率达到或超过 P 的最小候选集合，再从中采样。例如候选概率依次是 0.5、0.3、0.15、0.05，P 为 0.7 时保留前两个，因为累计概率已经达到 0.8。

两种截断方式的关键区别是：**Top K 固定候选数量，Top P 的候选数量随当前概率分布变化**。分布越集中，Top P 通常需要保留的候选越少；分布越分散，就需要保留更多候选才能达到阈值。
