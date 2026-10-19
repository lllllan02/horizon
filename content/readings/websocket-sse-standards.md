---
title: "WebSocket 与 SSE 标准要点"
category: "计算机网络"
tags: ["协议"]
learning_status: pending
created_at: "2026-10-19T13:43:27+08:00"
updated_at: "2026-10-19T13:43:27+08:00"
source:
  - "https://www.rfc-editor.org/rfc/rfc6455.html"
  - "https://html.spec.whatwg.org/multipage/server-sent-events.html"
---

**「WebSocket 提供双向消息通道，SSE 提供服务端到客户端的文本事件流。」** 本文节选 RFC 6455 §1.1–1.3 与 HTML 标准的 Server-sent events 章节，核对于 2026-10-19；仅覆盖通信方向、基本传输与 SSE 重连，未覆盖完整协议、安全要求或部署验证。

## WebSocket

[RFC 6455 §1.1–1.2](https://www.rfc-editor.org/rfc/rfc6455.html#section-1.1)从即时通信、游戏等双向交互需求出发：轮询接收更新、再单独发送请求，会增加请求头及连接协调开销。WebSocket 在同一条 TCP 连接上支持双向通信，握手成功后，双方可以独立发送消息，无需等待对方先发起请求。

[§1.3 的 HTTP/1.1 握手](https://www.rfc-editor.org/rfc/rfc6455.html#section-1.3)使用 `Upgrade: websocket`，服务端通过 `101 Switching Protocols` 等响应字段确认。随后消息由一个或多个 WebSocket 帧承载，支持 UTF-8 文本与二进制数据，也有关闭等控制帧。此处描述的是 RFC 6455 的握手方式，不概括其他 HTTP 版本的连接建立机制。

## SSE

[HTML 标准的介绍与事件流解析](https://html.spec.whatwg.org/multipage/server-sent-events.html#server-sent-events)定义了服务端推送事件的方式：客户端打开请求，服务端在响应中持续发送 `text/event-stream`，事件流始终使用 UTF-8。`data` 字段保存事件数据，`event` 可指定类型，空行触发事件派发；这也意味着只有持续返回字节、却不遵守事件格式的 HTTP 响应不能直接当作 SSE。

浏览器的 `EventSource` 提供接收接口。[处理模型](https://html.spec.whatwg.org/multipage/server-sent-events.html#processing-model-5)规定符合条件的断线重连；致命错误或主动 `close()` 会停止重连。流中提供事件 `id` 后，客户端可在重连请求中携带 `Last-Event-ID`，帮助服务端定位接收进度；服务端仍须实现保留和补发，才能恢复遗漏事件。
