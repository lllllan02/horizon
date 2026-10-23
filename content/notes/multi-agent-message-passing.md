---
title: "多 Agent 的消息传递"
parent: multi-agent-communication
category: "Agent"
tags: ["Agent", "多Agent协作", "上下文管理"]
learning_status: organized
created_at: "2026-10-22 14:41:09"
updated_at: "2026-10-23 18:51:51"
learning_status_changed_at: "2026-10-23 19:05:51.540"
---

**消息是成员间交付的一份协作数据，可以传发现、问题、进度或成果。** A、B 各自工作时，可通过消息交换后续处理所需的信息。这属于[[multi-agent-communication|信息与成果传递]]的一种方式。

## 谁决定发送，谁实际发送

**程序可以按规则触发，模型可以通过发送工具提出请求；实际投递都由程序执行。** 两种入口可以共存：

![[assets/multi-agent-message-flow.png|640]]

模型提出请求后，还需要相应的[[langchain-multi-agent#具体怎样实现？|工具执行逻辑]]；口头说「请告诉 B」不会自行发送。B 收件后，也须由程序将消息安排进后续模型输入，才能开始处理。

## 发送的消息是什么

例如「A 请 B 核对任务 t1 的证据 X」，可表示为：

```json
{
  "id": "m1",
  "task_id": "t1",
  "from": "A",
  "to": "B",
  "kind": "review_request",
  "body": "请核对证据 X；出处 doc-1"
}
```

字段标明消息、任务、双方身份、类型与内容。这是自拟教学格式：内存中可用结构体表示，网络中可编码成 JSON，实际字段由应用或协议约定。

## 可以怎样投递，怎样确认结果

- **Channel**：同一 Go 进程内，用 `inboxB <- msg` 投递、`msg := <-inboxB` 接收；[[assets/agent-message-delivery.go|发送示例]]包含阻塞时的超时退出。
- **HTTP**：将 JSON POST 到 B 的接口，由处理函数解码并交给运行程序；[[a2a-protocol-specification#HTTP 调用与返回|A2A 的 HTTP 绑定]]是协议化的例子。
- **消息队列**：发送方发布消息，消息系统暂存、分发，接收方消费，用于[[messaging-patterns-sources#异步与发布订阅|分离发送与处理]]。

发送工具应明确成功表示「已入队」「已接收」还是「已处理」。[[rabbitmq-reliability-sources#生产者确认与重发|投递确认不等于处理完成]]：需要处理结果时，应约定带原消息 ID 的回信；重试可能重复投递，接收程序需按约定去重。以上为教学设计，未接真实模型或做服务联调。
