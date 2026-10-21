---
title: "OpenAI：结构化输出与严格工具参数"
category: "Agent"
tags: ["Agent", "工具调用"]
learning_status: pending
created_at: "2026-10-21 14:08:33"
updated_at: "2026-10-21 14:08:33"
source: "https://developers.openai.com/api/docs/guides/structured-outputs"
---

**OpenAI 的 Structured Outputs 可约束回复结构或工具参数符合受支持的 JSON Schema；业务正确性与执行结果仍由应用检查。** 本篇节选 2026-10-21 的[结构化输出指南](https://developers.openai.com/api/docs/guides/structured-outputs)与[函数调用指南](https://developers.openai.com/api/docs/guides/function-calling)，未进行 API 联调，不涵盖全部 Schema 特性。

## JSON mode 与严格 Schema 有什么区别？

在提示词中要求 JSON 或写出 Schema，仍依赖模型遵循指令。指南区分两种接口约束：

- **JSON mode**：使用 `type: "json_object"`，保证 JSON 语法，不保证符合指定字段与类型；仍需提示模型生成 JSON，并处理不完整响应。
- **严格结构化输出**：使用 `type: "json_schema"`、Schema 与 `strict: true`，约束受支持的结构。Chat Completions 在 `response_format` 指定类型，将 `name`、`schema`、`strict` 放入其 `json_schema`；Responses 将这些字段直接放入 `text.format`。

[支持的 Schema](https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas)要求对象设置 `additionalProperties: false`，并将全部属性列入 `required`；可空类型可表达没有值。不支持的严格 Schema 会被拒绝。指南的数学辅导示例将解释和答案分别放进字段，说明自然语言也能作为结构中的字符串返回。

## 工具调用严格约束什么？

[严格工具调用](https://developers.openai.com/api/docs/guides/function-calling#strict-mode)使用相同的结构化输出能力约束模型生成的函数参数。显式设置 `strict: true` 并提供兼容 Schema，才能明确要求严格约束；Chat Completions 省略时默认非严格，Responses 会尝试规范化，不兼容则回退为非严格。

`tool_choice` 控制是否调用及选择哪个工具，与参数严格性分别配置。工具请求还需应用执行；[工具结果](https://developers.openai.com/api/docs/guides/function-calling#executing-functions)可以是文本或序列化 JSON，并不自动受参数 Schema 约束。

## 应用仍需处理哪些边界？

拒绝可能不符合业务 Schema，输出也可能因长度限制而不完整；应先判断状态，再使用业务对象。结构合法仍可能包含错误值，应用需要业务校验。不能使用严格约束时，指南建议用验证库并按需重试。

严格 JSON 可以避免外围 Markdown 代码围栏，但字符串字段仍可包含 Markdown；若字段内容也禁止 Markdown，需要另行约定并检查。

据此，接入第三方兼容服务时，应分别核对端点、字段与模型能力，不能仅凭“OpenAI 兼容”推定具备同等保证；这是接入建议，本篇未验证具体服务商。
