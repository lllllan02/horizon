---
title: "模型调用中的 Temperature 是什么，怎样起作用？"
aliases: ["温度参数", "Temperature"]
category: "大模型"
parent: interview-hub
tags: ["面试"]
learning_status: pending
created_at: "2026-10-19T11:35:01+08:00"
updated_at: "2026-10-19T11:35:01+08:00"
---

**温度（Temperature）是模型生成时控制随机性的采样参数**，用来调节输出的稳定性和多样性。

模型每生成一个 token（文本片段），都会先给候选 token 打分。温度的作用方式是把这些分数（logits）除以温度，再通过 softmax 转成概率，最后按概率抽取下一个 token。

**「温度越低，概率越集中」**，模型更倾向于选择高分候选，输出更稳定；**「温度越高，概率越平缓」**，低分候选也更容易被选中，输出更多样。温度为 1 时不改变原来的分数；低温并不保证答案更正确。
