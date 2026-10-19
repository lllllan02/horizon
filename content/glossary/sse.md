---
title: "SSE（服务端发送事件）"
aliases: ["SSE", "Server-Sent Events", "服务端发送事件", "服务器发送事件"]
category: "计算机网络"
tags: ["协议"]
learning_status: pending
created_at: "2026-10-19T13:43:27+08:00"
updated_at: "2026-10-19T13:43:27+08:00"
---

**SSE（Server-Sent Events）是服务端通过 HTTP 响应流，持续向客户端发送文本事件的机制。** 客户端发起请求后可以持续接收更新，适合通知、任务进度和大模型文本流式输出，减少反复查询是否有新内容的需要。

SSE 使用 [[websocket-sse-standards#SSE|HTML 标准定义的事件流格式]]：响应类型为 `text/event-stream`，内容采用 UTF-8 编码，`data:` 承载数据，空行分隔事件。浏览器原生 `EventSource` 可以解析事件，并在符合条件的断线后自动重连；恢复遗漏内容仍需服务端配合。

**「单向」约束的是这条事件流**：它只承载服务端到客户端的业务消息，客户端仍可通过其他 HTTP 请求提交输入。需要双方沿同一条连接持续发送消息时，可以使用 [[websocket|WebSocket]]。
