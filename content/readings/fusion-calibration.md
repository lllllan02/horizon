---
title: "混合检索融合权重的实验依据"
category: "RAG"
tags: ["RAG", "检索", "检索评测"]
type: "article"
learning_status: pending
created_at: "2026-10-18T22:22:00+08:00"
updated_at: "2026-10-18T22:24:24+08:00"
source:
  - "https://arxiv.org/html/2210.11934"
  - "https://www.elastic.co/search-labs/blog/improving-information-retrieval-elastic-stack-hybrid/"
---

**融合权重可以作为可调参数，用带相关性标注的数据学习或搜索。研究与维护方实验支持这种确定方法，没有给出可直接迁移到任意项目的固定比例。** 本篇依据 2026-10-18 读取的资料，节选权重来源及适用边界，未复现实验。

## 原始研究把什么作为参数？

Bruch、Gai 与 Ingber 的 [An Analysis of Fusion Functions for Hybrid Retrieval](https://arxiv.org/html/2210.11934)（2023 年修订版，§1、§3、§4.1）研究归一化后的词项分数与语义分数的凸组合：`α × 语义分 + (1-α) × 词项分`。正文主要比较 BM25 与 all-MiniLM-L6-v2，并使用相关性标注评价融合后的排序。

作者观察到，加入第二路信号能帮助区分单路分数难以区分的相关与无关文档，但这种分布在不同数据集上不同。论文把 α 视为可针对目标领域学习的参数，并报告少量标注查询就能有效调参的实验结果；这不构成某个项目所需标注量或固定权重的保证。

## 检索系统维护方怎样选择权重？

Elastic 的 [Hybrid retrieval 实验](https://www.elastic.co/search-labs/blog/improving-information-retrieval-elastic-stack-hybrid/#weighted-sum-of-scores)（2023-07-20，Weighted Sum of Scores 节）先对分数做 min-max 处理，再在 BEIR 标注数据上，通过贝叶斯优化搜索使 NDCG@10 较好的融合系数。它不是由两路分数的均值直接推算权重，而是反复比较候选系数产生的排序质量。

该节的加权实验组合是 BM25 与 ELSER，后者是学习型稀疏模型，不能当作任意稠密模型的直接实测。作者观察到，归一化后较优权重仍随数据集和模型变化，并指出数据分布显著变化后需要重新校准。

两份材料提供的是「用标注数据优化权重」的依据，不是 0.4/0.6 的依据。论文或公开基准中的较优值，仍需在目标项目上验证；没有代表性标注时，默认值只能作为待验证的起点。
