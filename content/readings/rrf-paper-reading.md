---
title: "RRF 原始论文：常数 60 的来源"
category: "信息检索"
tags: ["检索", "检索评测"]
type: "article"
learning_status: pending
created_at: "2026-10-18T22:46:36+08:00"
updated_at: "2026-10-18T22:46:36+08:00"
source: "https://cormack.uwaterloo.ca/cormack/cormacksigir09-rrf.pdf"
---

**RRF 原始论文中的常数 60 来自预实验选择：作者发现它接近最优，随后固定该值进行验证。它有实验依据，不是由公式推导出的唯一取值。** 本篇依据 2026-10-18 读取的 SIGIR 2009 论文，节选公式、参数选择与验证，不覆盖全部方法对比，未复现实验。

## 为什么在名次前加常数？

Cormack、Clarke 与 Büttcher 在[论文第 1 节](https://cormack.uwaterloo.ca/cormack/cormacksigir09-rrf.pdf#page=1)按 `Σ 1 / (k + rank)` 融合各路排名。作者的设计考虑是：高排名应更重要，但低排名的贡献也不应快速消失；常数 k 则减轻某一路异常靠前排名的影响。这里的 k 是平滑常数，不是返回条数。

## 60 是怎样选出的？

作者在四个 TREC 数据集上进行预实验，每个实验融合 Wumpus Search 的 30 种配置。第 2 页表 1 比较不同 k 对 MAP 的影响：k=60 时为 0.2145，k=80 时为 0.2147。两者接近，因此论文称 60「接近最优」，没有将它称为唯一最优值。

选定 60 后，作者在后续验证中不再调整该值，包括融合 TREC 参赛系统的结果。这提供了经验参数及验证依据；这些实验没有直接验证今天任意 BM25 与稠密模型组合，也不能保证当前业务同样适合 60。
