---
title: "MCP 是什么，解决了什么问题？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "MCP", "工具调用"]
learning_status: organized
created_at: "2026-10-21 14:10:51"
updated_at: "2026-10-21 14:15:52"
learning_status_changed_at: "2026-10-21 14:19:44.052"
---

[[tool-calling|工具调用]]给模型提供查询数据、执行操作的能力。模型通过 [[openai-function-calling-summary|Function Calling]] 提出调用请求，程序实际执行，再把结果交回模型。

开发多个 Agent 或 AI 应用时，它们可能都需要访问相同的外部服务。如果每个应用都单独接入，就会重复编写和维护接入代码。

[[mcp|MCP]] 就是一套「**统一 AI 应用与外部服务交互方式的开放协议**」。我们可以把通用工具封装成 MCP Server，各个支持 MCP 的应用通过内部的 Client 连接 Server，发现并调用相应工具，从而复用同一套实现，减少重复接入工作。

它的核心是统一接入标准；集中维护工具是其中一种用法。除了工具，MCP 还可以提供[[mcp-capabilities|资源和提示模板]]。
