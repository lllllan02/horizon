---
title: "RAG 的 chunk 策略怎么选？为什么？"
aliases: ["RAG 分块策略", "Markdown 文档切分策略", "chunk 大小怎么选"]
category: "RAG"
parent: retrieval-interview-index
tags: ["面试", "RAG", "检索"]
type: practice
learning_status: organized
created_at: "2026-10-21 16:57:16"
updated_at: "2026-10-21 17:04:04"
learning_status_changed_at: "2026-10-21 17:09:09.854"
---

假设资料都是 Markdown，我会采用**按结构切分、按长度兜底**的混合策略。

具体来说，先[[langchain-markdown-splitting|按标题划分章节]]，过长的章节再按段落、句子拆分，最后按固定长度截断；相关的短段可以组合，并给片段补上必要的标题背景。同一章节内因长度拆开的相邻块，可以加少量 [[azure-rag-chunking|overlap，也就是重复一部分边界文本]]。

这样做是因为 **chunk 太大容易混入无关内容，太小又容易丢失上下文**。优先按结构拆，能尽量保留连贯的内容；长度兜底则防止块过大，按 token 控制大小，兼顾 embedding 输入限制和生成上下文预算。Overlap 能缓解边界信息缺失，但会增加成本和重复召回，独立完整的章节可以不加。

**chunk 大小和 overlap 没有统一最优值。** 我会用有代表性的问题集，在相同上下文预算下比较证据召回、[[rag-evaluation-docs|回答正确性和依据一致性]]，结合延迟与成本调整参数，再用未参与调参的样本验证。
