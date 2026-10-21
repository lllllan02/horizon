---
title: "TF-IDF"
aliases: ["词频—逆文档频率", "Term Frequency–Inverse Document Frequency", "TFIDF"]
category: "信息检索"
tags: ["检索", "全文检索"]
learning_status: pending
created_at: "2026-10-18 21:37:01"
updated_at: "2026-10-18 21:37:01"
---

**TF-IDF（Term Frequency–Inverse Document Frequency，词频—逆文档频率）是一种词项权重计算方法，通过结合词项在当前文档中的出现频率与其在文档集合中的稀有程度，估计词项对该文档的代表性。**

仅按出现次数赋权，容易让大量文档中都常见的词占据较高权重。[[rasa-intent-classification#文字怎样变成可计算的表示？|TF-IDF 加权]]将两个因素相乘，降低这类词的影响：

- 词频（TF，Term Frequency）：反映词项在当前文档中的出现频率，可使用原始计数或经过变换的计数。
- 逆文档频率（IDF，Inverse Document Frequency）：根据文档总数和包含该词项的文档数计算。包含它的文档越少，其区分能力通常越强，IDF 越高。

基本关系为 `TF-IDF(t, d) = TF(t, d) × IDF(t)`，其中 `t` 为词项，`d` 为文档。各词项的权重可组成文档的数值表示，用于检索、分类等任务；具体实现还可能进行 IDF 平滑和向量归一化。

TF-IDF 计算的是词项在文档中的权重；[[bm25|BM25]]直接计算查询与文档的相关性分数。TF-IDF 权重也能进一步用于查询与文档的匹配评分，但权重本身不等于两者的相关性分数，也不代表对文本语义的完整理解。
