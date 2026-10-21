---
title: "RAG 的完整流程是什么？"
aliases: ["RAG 完整流程", "知识库问答流程", "检索增强生成面试题", "知识库与检索怎样参与回答"]
category: "RAG"
parent: retrieval-interview-index
tags: ["面试", "RAG", "检索"]
learning_status: organized
created_at: "2026-10-20 16:23:41"
updated_at: "2026-10-20 16:30:47"
learning_status_changed_at: "2026-10-20 16:31:56.742"
---

RAG 就是检索增强生成：先找出与问题相关的外部资料，再交给模型回答，让模型能使用业务知识和更新后的内容。下面以向量检索为例，分成两部分。

## 知识库准备

1. **解析与清洗**：从 PDF、网页等资料中提取正文，清理噪声，[[docling-document|保留标题、表格和来源]]。可以转成 Markdown，但不强制统一格式。
2. **文档拆分**：[[rag-chunking-interview|按标题、段落切分]]，过长时再按长度拆，必要时加 overlap 保留边界上下文。[[azure-rag-chunking|块大小和重叠量]]需要评测调整。
3. **向量化与建索引**：将片段编码成向量，同时保存或关联原文、文档 ID、来源位置、版本和权限，方便检索后取回内容。

## 在线问答

1. **检索召回**：将问题编码成兼容的向量，在用户权限范围内查找候选，也可结合[[hybrid-retrieval-interview|关键词检索]]。检索可以由程序触发，也可[[langchain-rag-architectures|作为工具交给 Agent 调用]]；RAG 也能直接使用已有搜索服务或数据库。
2. **筛选与重排**：需要时用专门模型或大语言模型[[rag-retrieval-ranking#为什么分成召回与重排？|重新评估候选相关性]]，去重后按上下文预算选取片段。重排可选，条数没有固定最优值。
3. **生成回答**：将问题、片段和来源标识一起放进上下文，让模型依据资料回答并给出出处。资料中的指令不能获得系统或工具权限。

**维护与异常**：[[rag-document-validity-interview|资料更新、删除或过期]]时，[[llamaindex-document-management|同步原文与索引]]，并处理[[rag-security-docs|权限变化和相关缓存]]。检索为空时检查导入、查询和过滤条件，必要时追问或再检索；仍无依据就说明不足。用固定问题集[[rag-evaluation-docs|分别评测检索和回答质量]]，据此调参。
