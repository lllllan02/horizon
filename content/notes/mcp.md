---
learning_status: organized
title: "MCP（模型上下文协议）"
parent: tool-calling
aliases: ["MCP", "Model Context Protocol", "模型上下文协议"]
category: "Agent"
tags: ["MCP", "工具调用", "协议"]
created_at: "2026-10-09"
updated_at: "2026-10-19 13:42:18"
reading_suggestions:
  - mcp-capabilities
  - mcp-flow
  - mcp-server
  - mcp-client
  - mcp-http-server
  - mcp-http-client
  - mcp-permissions
  - mcp-architecture-summary
learning_status_changed_at: "2026-10-19 13:45:44.296"
---

**MCP（Model Context Protocol，模型上下文协议）是 AI 应用与外部服务之间的开放通信协议，统一工具、资源和提示模板的发现与使用方式。**

多个 AI 应用各自对接文件、数据库或业务 API，会重复编写适配代码。MCP 将业务适配集中到服务端，让兼容应用复用同一套能力；只有少量固定调用时，直接接函数或 API 也可以。

## 基本工作方式

在 [[mcp-architecture-summary|MCP 架构]]中，宿主应用（Host）组织模型与上下文，内部的客户端（Client）按 MCP 与服务端（Server）通信。Server 按需提供[[mcp-capabilities|可调用的操作、可读取的数据和可复用的提示消息]]，并负责具体实现。

![[assets/mcp-overview-illustrated.png|640]]

以[[mcp-flow|工具接入流程]]为例：Host 获取工具定义交给模型；模型提出工具名与参数后，Host 经 Client 请求 Server 执行，再把结果交回模型。**「MCP 统一服务接入，Host 负责把它接入工具调用循环。」**

## 接入与边界

- **「stdio」**：[[mcp-client|Client]] 启动本地 [[mcp-server|Server]] 子进程，通过标准输入输出通信。
- **「Streamable HTTP」**：[[mcp-http-server|Server]] 独立运行，[[mcp-http-client|Client]] 通过 URL 连接，适合远程服务。

接通协议后，Host 仍需选择能力、组织上下文和处理调用失败；服务端及下游系统仍需检查业务权限。[[mcp-permissions|连接授权、业务权限与操作确认]]是不同的判断，**「工具可见不等于获准执行」**。
