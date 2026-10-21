---
title: "为什么要做混合检索？"
aliases: ["RAG 为什么同时使用 BM25 和向量检索？", "为什么要做稀疏加稠密双路召回？", "稀疏与稠密双路召回面试题", "混合检索面试题"]
category: "信息检索"
parent: retrieval-interview-index
tags: ["面试", "检索", "召回"]
learning_status: organized
created_at: "2026-10-18 22:02:34"
updated_at: "2026-10-21 11:53:58"
learning_status_changed_at: "2026-10-21 11:55:57.427"
---

在 RAG 中，[[rag-retrieval-ranking#为什么结合词项与语义检索？|混合检索]]的目的是**结合词项匹配与语义匹配的优势，弥补单路召回的遗漏**。

[[bm25|BM25]] 根据查询与文档中的词项匹配来评分，对专业术语、内部黑话、产品编号、错误码这类具体表达，通常比较有优势。

但用户提问时未必使用资料中的术语，可能换一种说法，或者直接描述需求。[[dense-retrieval|向量检索]]按语义相似度匹配，能够补充**用词不同、意思相关**的结果。

因此，可以让两路分别召回候选，再通过 [[retrieval-fusion-interview|RRF 等方法融合排序]]。
