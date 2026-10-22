---
title: "记忆更新：候选召回、冲突判断与局部修改"
category: "Agent"
tags: ["Agent", "记忆"]
learning_status: pending
created_at: "2026-10-22 09:27:58"
updated_at: "2026-10-22 09:27:58"
source:
  - "https://arxiv.org/html/2504.19413v1#S2.SS1"
  - "https://github.com/getzep/graphiti/blob/main/graphiti_core/prompts/dedupe_edges.py"
  - "https://github.com/hinthornw/trustcall#updating-schemas"
---

**记忆更新的可靠性涉及不同环节：Mem0 分开候选召回与操作决策，Graphiti 细化重复和冲突的判定，Trustcall 减少整份档案重写造成的信息丢失。** 三者提供可参考的机制，不能据此认定语义匹配已可靠。本文只节选与更新相关的部分；源码和 README 于 2026-10-22 核对，`main` 未固定提交，未运行实现或复现效果。

## Mem0：召回后再决定更新操作

[论文 v1 第 2.1 节](https://arxiv.org/html/2504.19413v1#S2.SS1)先从新交互及上下文提取候选事实，再为每条候选用向量检索找相近旧记忆。模型同时读取新旧信息，通过工具调用选择 `ADD`、`UPDATE`、`DELETE` 或 `NOOP`，由系统执行。

这种划分把「可能相关」与「应如何修改」分开。旧记录没有被召回，模型就缺少比较依据；找到了候选，也仍可能误判关系。论文描述研究算法，不能据此推断当前各版本 API 的自动覆盖、删除行为，也没有给出可直接复用的业务匹配可靠率。

## Graphiti：重复与冲突分别判定

[`dedupe_edges.py` 的 `resolve_edge`](https://github.com/getzep/graphiti/blob/main/graphiti_core/prompts/dedupe_edges.py)分别返回重复事实与矛盾事实。提示词要求保留数值、日期和限定条件的差异；判断矛盾要有旧事实被终止、替代或两者不能同时成立的依据，不能只看新记录出现得更晚。

例如，同一人周二跑 5 英里、周三跑 3 英里属于不同事件，可以并存。这些规则让模型有更明确的比较维度；它们仍是判定要求，不能证明模型每次都遵守，更不能代替实际错例评测。

## Trustcall：用局部补丁更新档案

[README 的 Updating schemas](https://github.com/hinthornw/trustcall#updating-schemas)以用户档案演示：模型重写整个 JSON 时，可能遗漏与本次变化无关的旧字段。Trustcall 让模型生成 JSON Patch，只修改所需部分；结构校验失败时，再针对错误生成修复补丁。

该机制适合减少已定位档案的更新范围，并处理结构校验错误。它不能证明选中了正确档案、属性或事实；格式合法的补丁仍可能写错内容。README 的演示也不能直接当作业务可靠率结论。
