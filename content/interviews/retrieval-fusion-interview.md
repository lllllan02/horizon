---
title: "混合检索的结果怎么融合？"
aliases: ["双路召回融合面试题", "召回结果怎么融合"]
category: "信息检索"
parent: retrieval-interview-index
tags: ["面试", "检索", "召回", "重排"]
learning_status: organized
created_at: "2026-10-18 22:11:42"
updated_at: "2026-10-21 11:47:42"
learning_status_changed_at: "2026-10-21 11:56:50.617"
---

先分别用[[hybrid-retrieval-interview|稀疏召回和稠密召回]]得到各自的候选集，合并、去重，保留每个候选在两路中的分数和排名，再做统一排序。常见的融合方式有两种。

第一种是**分数归一化后加权**。两路原始分数的尺度不同，不能直接相加比较。可以先分别缩放到 0 到 1，再乘各自的权重，最后相加排序。

第二种是 **RRF，也就是倒数排名融合**。它只看文档在每一路排第几，按 `1 / (c + rank)` 算出贡献，再把两路贡献相加排序。名次从 1 开始，某一路没召回就不贡献分数。这样就不用比较两路原始分数的尺度；同一候选在两路都靠前时，会得到更多贡献。

标准 RRF 各路等权；[[rag-retrieval-ranking#多路分数为什么需要融合？|加权 RRF]] 则按 `Σ weight_i / (c + rank_i)` 累加，权重越大，该路排名的贡献越大。这里的 c 调节不同名次之间的贡献差距，可以参考[[rrf-paper-reading|论文实验选取的 60]]，它与两路权重、返回条数是不同参数。具体[[retrieval-fusion-weight-interview|权重怎么确定]]，还需要通过业务评测选择。

