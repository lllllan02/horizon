---
title: "为什么 Temperature 设为 0，输出仍可能不一致？"
aliases: ["零温度与输出一致性"]
category: "大模型"
parent: interview-hub
tags: ["面试"]
learning_status: organized
created_at: "2026-10-22 13:19:52"
updated_at: "2026-10-22 14:15:14"
learning_status_changed_at: "2026-10-22 14:15:51.633"
---

[[llm-sampling-interview|Temperature]] 控制下一个 token 的概率分布。设为 0，通常就是每一步选择概率最高的 token，让输出更稳定。

但模型[[llm-reproducibility-sources#分数为什么可能略有不同|后台计算仍可能有细微差异]]。如果两个候选 token 的分数很接近，这种差异就可能改变谁排第一，让模型选出不同的 token；前面的内容变了，后面的回答也可能跟着变。

所以，**Temperature 设为 0 能提高输出稳定性，但不能保证最终结果一模一样。**
