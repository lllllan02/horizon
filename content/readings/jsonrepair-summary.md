---
title: "jsonrepair：修复不合法的 JSON"
category: "Agent"
tags: ["Agent", "JSON"]
learning_status: pending
created_at: "2026-10-21 14:19:52"
updated_at: "2026-10-21 14:19:52"
source: "https://github.com/josdejong/jsonrepair"
---

**jsonrepair 尝试把不合法的 JSON 文本修复为可解析的 JSON；修复成功不代表恢复了原意。** 本篇节选维护方 [README](https://github.com/josdejong/jsonrepair#readme) 及实现，按 2026-10-21 的主分支核对，未安装或运行实测。

README 列出的处理包括补充键名引号、去除尾逗号、剥离 Markdown 代码围栏。输入是需要修复的文本，成功时返回修复后的 JSON 字符串；遇到无法修复的问题会抛出 `JSONRepairError`，因此调用方仍要处理失败。

[常规实现](https://github.com/josdejong/jsonrepair/blob/main/src/regular/jsonrepair.ts)在缺失对象值时可能补入 `null`。这说明修复器会作出语法补全，调用方不能据此认定模型原本就想返回该值。

据此，模型输出的处理可以分成两件事：先定位需要的数据片段，再尝试修复其语法。剥离代码围栏不等于能从任意说明文字中可靠提取目标；多个 JSON 候选时如何选择，需要应用定义规则。以上是接入建议，提取或修复后仍应解析并检查 Schema 与业务值；失败或有歧义时不直接使用。
