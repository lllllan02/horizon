---
title: "LangChain：Markdown 标题切分与长度兜底"
category: "RAG"
tags: ["RAG"]
type: article
learning_status: pending
created_at: "2026-10-21 16:57:16"
updated_at: "2026-10-21 16:57:16"
source: "https://docs.langchain.com/oss/python/integrations/splitters/markdown_header_metadata_splitter"
---

LangChain 的 Markdown 切分教程先按标题组织内容，再对超长章节继续切分，让结构边界与块大小约束配合。本篇节选标题、metadata 与 overlap 的行为，依据 2026-10-21 官方页面，未运行示例。

## 标题切分保留了什么？

`MarkdownHeaderTextSplitter` 根据指定的标题层级聚合正文，并将对应标题保存到每个输出文档的 metadata。例如原文的 `Foo → Bar` 和 `Foo → Baz` 两节分别产生文档，metadata 保留各自的标题路径。

默认 `strip_headers=True`，标题从 `page_content` 中去掉；设为 `False` 后，原本出现的标题会保留在正文中，但官方后续切分示例表明，并非每个子块都会自动重复完整标题路径。[原文示例](https://docs.langchain.com/oss/python/integrations/splitters/markdown_header_metadata_splitter#basic-usage)

由此可得一个接入时需要检查的条件：如果向量化只读取 `page_content`，只把标题存在 metadata 中，不等于 embedding 已包含标题。需要标题背景时，应由应用显式组装相应文本；这是根据字段分工得出的工程建议。

## 怎样限制长度，overlap 又作用在哪里？

标题切分后的章节仍可能过长。教程把这些文档交给 `RecursiveCharacterTextSplitter.split_documents` 继续切分，保留每节的标题 metadata。示例参数是字符切分配置，不能直接解释成 token 数。[长度约束示例](https://docs.langchain.com/oss/python/integrations/splitters/markdown_header_metadata_splitter#how-to-constrain-chunk-size)

官方排障说明指出，这种组合中的 overlap 作用于同一章节继续切出的子块，不跨章节或文档边界。章节没有超过长度限制时，不会因为设置 overlap 就额外产生重叠块；参数也不代表任意两个输出块都必然具有指定数量的重复文本。[overlap 边界](https://docs.langchain.com/oss/python/integrations/splitters/markdown_header_metadata_splitter#troubleshooting-chunk_overlap-doesnt-seem-to-apply)

这份教程说明了组件怎样组合，未给出适合所有语料的块长或重叠量。检索效果仍需结合文档与问题集验证，不能把示例配置视为最优策略。
