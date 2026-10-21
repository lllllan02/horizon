---
title: "Pydantic AI：运行预算与分层超时"
category: "Agent"
tags: ["Agent", "工具调用", "超时"]
learning_status: pending
created_at: "2026-10-21 12:55:19"
updated_at: "2026-10-21 12:55:19"
source:
  - "https://pydantic.dev/docs/ai/core-concepts/agent/#usage-limits"
  - "https://pydantic.dev/docs/ai/core-concepts/timeouts/"
---

**Pydantic AI 分别限制模型轮数、成功工具调用量与整次运行时间；单一计数器不能覆盖所有消耗。** 本文节选官方文档中与无限循环防护有关的部分。

## 轮数与工具次数的口径

[Usage Limits](https://pydantic.dev/docs/ai/core-concepts/agent/#usage-limits)用 `request_limit` 限制模型轮数，示例中的工具不断抛出 `ModelRetry`，运行仍会因请求预算耗尽而结束。`tool_calls_limit` 则只限制成功工具调用，不能单独防住持续失败；同轮并行调用若将超过额度，整批不执行。

Token 与费用限制也有检查时机：输出消耗和费用通常在响应后才可确认，费用计算还依赖可用的价格和用量数据，因此不能当作严格的账单封顶保证。恢复运行时，可通过传入此前用量让限制覆盖累计消耗；应用仍须负责传递，不能假设新运行自动继承预算。

## 局部超时与整次运行超时

[Timeouts](https://pydantic.dev/docs/ai/core-concepts/timeouts/)区分单次尝试、完整模型请求、工具和整次运行。`request_timeout` 覆盖一次模型请求内的 SDK／传输重试、退避等待及完整流式读取；运行方法的 `timeout` 限制整次运行，触发 `RunTimedOut` 并携带已完成的记录。

工具超时可能转成模型可见的重试提示，所以还需限制后续修正。同步工具在线程中执行时，结束等待不能强制终止该线程，已有副作用也不会回滚；外部工具集的超时需在各自执行或传输层配置。

以上按 2026-10-21 在线文档核对，未固定发行版本，未运行示例。按工具名与规范化参数做指纹、检测多轮无进展，以及父子 Agent 共享任务预算，属于应用层设计建议，并非本文核实的框架自动保证。
