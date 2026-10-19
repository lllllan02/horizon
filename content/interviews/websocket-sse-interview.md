---
title: "WebSocket 和 SSE 有什么区别？"
category: "计算机网络"
parent: interview-hub
tags: ["面试"]
learning_status: organized
created_at: "2026-10-19T13:37:49+08:00"
updated_at: "2026-10-19T13:37:49+08:00"
learning_status_changed_at: "2026-10-19T13:51:57.499+08:00"
---

[[websocket|WebSocket]] 和 [[sse|SSE]] 都可以实现**「实时通信」**，主要区别是通信方向。

WebSocket 是**「全双工通信」**，连接建立后，客户端和服务端都能主动发送消息，比较适合聊天、协同编辑这类需要双方持续交互的场景。

SSE 是**「基于 HTTP 的服务端单向推送」**，客户端发起请求后，服务端可以在响应流中持续发送消息。它比较适合大模型文本流式输出：客户端提交问题后，主要就是不断接收服务端生成的内容，不需要在同一条流上持续向服务端发送消息。
