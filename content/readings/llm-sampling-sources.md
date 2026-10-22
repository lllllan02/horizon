---
title: "Hugging Face：Temperature、Top K 与 Top P"
category: "大模型"
type: article
tags: ["大模型"]
learning_status: pending
created_at: "2026-10-22 13:14:00"
updated_at: "2026-10-22 13:14:00"
source:
  - "https://huggingface.co/docs/transformers/main/en/main_classes/text_generation#transformers.GenerationConfig"
  - "https://huggingface.co/docs/transformers/internal/generation_utils#transformers.TemperatureLogitsWarper"
---

Hugging Face 文档将三者作为生成时调整候选 token 概率与范围的参数：**Temperature 调整分布的集中程度，Top K 按数量截断，Top P 按累计概率截断**。本篇节选 GenerationConfig 的三个参数及对应生成工具说明，核对于 2026-10-22 的在线文档；GenerationConfig 使用 main 版本，未运行模型验证。

## 温度怎样影响采样

[TemperatureLogitsWarper](https://huggingface.co/docs/transformers/internal/generation_utils#transformers.TemperatureLogitsWarper) 说明，温度小于 1 时降低随机性，大于 1 时提高随机性。前者让概率向高分候选集中，后者让低分候选获得更多被抽取的机会。

文档特别限定：Transformers 的 `generate` 必须启用 `do_sample=True`，温度才对采样起作用。原文示例将温度从 1 调到接近 0，展示输出趋近贪心选择；它用于说明采样变化，不能据此推断低温会提高事实准确率。

## 两种候选截断方式

[GenerationConfig](https://huggingface.co/docs/transformers/main/en/main_classes/text_generation#transformers.GenerationConfig) 将 `top_k` 定义为保留概率最高的 K 个词表 token，将 `top_p` 定义为保留按概率从高到低累积、总概率达到 P 或更高的最小集合。因此 Top P 的候选数量随每一步的分布变化。

依照定义可构造示例：概率为 0.5、0.3、0.15、0.05 时，K 为 3 会保留前三个，P 为 0.7 则保留前两个。后一种规则并非只保留单个概率超过 0.7 的 token，而是检查从最高概率开始的累计值。这是自拟演算，不是模型实测。

[TopKLogitsWarper](https://huggingface.co/docs/transformers/internal/generation_utils#transformers.TopKLogitsWarper) 与 [TopPLogitsWarper](https://huggingface.co/docs/transformers/internal/generation_utils#transformers.TopPLogitsWarper) 也说明这些参数可以组合使用。本篇只保留概念区别，不将特定框架的默认值或组合执行顺序推广为所有模型服务的约定。
