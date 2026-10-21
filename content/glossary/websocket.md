---
title: "WebSocket"
category: "计算机网络"
tags: ["协议"]
learning_status: pending
created_at: "2026-10-19 13:43:27"
updated_at: "2026-10-19 13:43:27"
---

**WebSocket 是一种应用层通信协议，允许客户端和服务端在同一条连接上进行全双工通信。** 连接建立后，双方都能主动发送消息，无需每次由客户端发起请求，适合聊天、协同编辑等需要持续双向交互的场景。

在 [[websocket-sse-standards#WebSocket|RFC 6455 定义的握手与消息传输]]中，客户端通过 HTTP/1.1 Upgrade 请求建立连接，握手成功后改用 WebSocket 帧传输文本或二进制消息。

与 [[sse|SSE]] 的服务端单向事件流相比，WebSocket 支持双方在同一条连接上持续发送业务消息；具体消息含义仍由应用约定。
