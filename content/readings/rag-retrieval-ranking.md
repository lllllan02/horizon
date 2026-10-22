---
title: "检索官方文档：词项评分、语义表示、融合与重排"
category: "RAG"
tags: ["RAG"]
type: "article"
created_at: "2026-10-13 10:49:42"
updated_at: "2026-10-22 09:54:21"
learning_status: pending
source: ["https://sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html", "https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking", "https://sbert.net/examples/sentence_transformer/applications/semantic-search/README.html", "https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables", "https://sbert.net/examples/sparse_encoder/applications/semantic_search/README.html", "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/linear-retriever", "https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview", "https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-query"]
---

这组官方资料解释词项评分、语义表示、候选模型重排与多路 RRF 融合。它们处理不同问题，可以组合。本文节选原理，不固定具体模型或服务默认值；未运行示例。

## 稀疏与稠密描述什么？

Sentence Transformers 的[稀疏语义检索说明](https://sbert.net/examples/sparse_encoder/applications/semantic_search/README.html)（2026-10-18 核对，节选定义与检索过程）按表示区分两者：稀疏向量多数位置为零，仅少数维度有非零值；稠密向量通常各维度都有非零值。传统稀疏方法依靠词项匹配，但 SPLADE 等学习型稀疏编码器也能捕捉语义，所以不能把「稀疏／稠密」直接等同于「关键词／语义」。

文档先编码语料，再编码查询，计算相似度并选出靠前的候选；也展示了由检索系统建立索引并完成查询的方式。利用大量零值可以减少无效存储与计算，非零维度通常对应词项，便于解释哪些词参与了匹配。本文未运行其示例，不将这些特征视为任意系统上的性能保证。

## 召回分数依据什么？

Elastic 的 BM25 文章把评分拆为词项区分度、词频与长度归一化：很常见的词区分能力较低，同一个词重复出现的增益逐渐饱和，长度因素避免长文仅因词多而占优。k1 影响词频饱和，b 控制长度归一化强度；参数不能脱离语料与分析器来解释。

Sentence Transformers 的语义检索文档区分对称任务与非对称任务。短问题查长段落属于后者，模型选择需匹配任务；`encode_query` 与 `encode_document` 可使用模型配置的不同提示或路由。因此查询与文档需要兼容表示，而不是强制把任意模型都用完全相同字符串方式调用。

## 为什么结合词项与语义检索？

Azure 的 [Hybrid search overview · Why use hybrid search](https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview#why-use-hybrid-search)（2026-10-21 核对，节选适用场景）指出，向量检索能找到概念上相似、即便没有共享词项的资料；产品代码、专业黑话、日期和人名等精确查询，则常能从关键词检索中受益。混合检索并行执行词项与向量查询，再融合候选，利用两种信号覆盖不同匹配需求。

这支持按查询与资料的用词关系理解两路互补，不构成「专业术语一律不适合向量」的结论，也不保证混合后每条查询都改善；具体收益需要在目标语料、分析器和模型上验证。

同页 [How does hybrid search work?](https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview#how-does-hybrid-search-work)（2026-10-22 核对）说明，文本字段与向量字段可共存于同一搜索索引中，分别使用全文与向量索引。因此，多路检索不要求多套独立存储，但需要相应的字段、表示和索引支持；不能把它理解成无需准备就能对任意存储使用所有检索方式。

## 为什么分成召回与重排？

Sentence Transformers 的 bi-encoder 分别编码问题和文档，**「文档表示可离线计算」**，适合大范围搜索。cross-encoder 同时读取一对问题与候选，能在二者之间做 attention，但需要逐对计算，因此通常只处理较小候选集。官方也展示了小文档直接对所有段落重排的例子，说明两阶段并非硬性要求。

重排器给出的相关性分数依赖模型和输出处理方式，**「不应一概当作正确概率」**。它改善已有候选的顺序，不能补回候选集之外的证据。

## 多路分数为什么需要融合？

Elastic 的 [Linear retriever 文档](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/linear-retriever#normalizers)（2026-10-18 核对，节选计分方式）给出先归一化、再加权求和的方法。Min-max 在每路内部用 `(score - min) / (max - min)` 缩放分数，再按 `Σ weight_i × normalized_score_i` 合成总分，避免原始数值范围大的一路仅因尺度而主导结果。它还区分每路参与融合的候选窗口与最终返回量。本文未运行其配置示例；相同数值范围不意味着两路分数具有相同概率含义，归一化方式与权重仍须验证。

Azure 指出 BM25、向量与语义重排的分数范围不同。RRF 对文档在各路的排名求 `1 / (c + rank)` 并累加，未出现的路不贡献分数；这样不用直接比较原始分值。这里用 c 区分平滑常数与返回条数 K。

Azure 的 [Weighted scores](https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking#weighted-scores) 与 [Vector weighting](https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-query#vector-weighting)（2026-10-21 核对）说明，向量权重作为乘数作用于该路排名贡献。标准 RRF 各路等权；加权形式可写为 `Σ weight_i / (c + rank_i)`，仍只累加该候选实际出现的路。Azure 通过向量查询的 weight 调整其相对贡献，文本一路隐含权重为 1.0；具体服务支持哪些路的权重，应按各自接口核对。权重改变路与路之间的贡献，c 改变同一路内各名次的贡献差距，两者不能混用。

同一文档在多路靠前会获得更多贡献，但 **「RRF 不检查文本内容，也不证明真实性」**。Azure 的 semantic ranker 在 RRF 后运行，并单独返回重排分。由此可把排障分成：各路是否找到、融合是否留下、重排是否选对。

[[fusion-calibration|融合权重的原始研究与维护方实验]]进一步说明了线性组合的系数怎样通过标注数据选择，以及较优权重为什么不能直接迁移到其他模型和数据集。
