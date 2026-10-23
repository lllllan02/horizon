---
title: "多 Agent 的消息传递"
parent: multi-agent-communication
category: "Agent"
tags: ["Agent", "多Agent协作", "上下文管理"]
learning_status: organized
created_at: "2026-10-22 14:41:09"
updated_at: "2026-10-23 23:17:09"
learning_status_changed_at: "2026-10-23 23:23:57.293"
---

**消息是成员间交付的一份协作数据，可以传发现、问题、进度或成果。** A、B 各自工作时，可用消息通知对方或请求处理，属于[[multi-agent-communication|信息与成果传递]]的一种方式。

## 消息怎样发出并接回任务

**程序可以按规则触发，模型也可通过发送工具提出请求；实际投递都由程序执行。** 两种入口可以共存：

![[assets/multi-agent-message-flow.png|640]]

模型提出的发送请求，仍须由相应的[[tool-calling|工具执行逻辑]]完成。接收程序按约定的任务标识关联任务，在后续处理时将相关消息与任务要求带入 B 的[[agent-context-input|后续模型输入]]，B 才能据此行动。

## 消息里需要什么

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

字段标明消息、任务、双方身份、类型与内容。这是自拟教学格式：内存中可用结构体表示，网络中可编码成 JSON；实际字段由应用或协议约定。

## 怎样投递与确认结果

消息可通过以下方式投递：

- **Go Channel**：同一 Go 进程内，用 `inboxB <- msg` 投递、`msg := <-inboxB` 接收；[[assets/agent-message-delivery.go|发送示例]]包含阻塞时的超时退出。
- **HTTP**：将 JSON POST 到 B 的接口，由接收程序解码并交给任务处理逻辑；[[a2a-protocol-specification#HTTP 调用与返回|A2A 的 HTTP 绑定]]是协议化的例子。
- **消息队列**：发送方发布，消息系统暂存、分发，接收方消费，用于[[messaging-patterns-sources#异步与发布订阅|分离发送与处理]]。

发送接口应明确成功表示「已入队」「已接收」还是「已处理」。[[rabbitmq-reliability-sources#生产者确认与重发|投递确认不等于处理完成]]：需要处理结果时，应约定带原消息 ID 的回信；重试可能重复投递，接收程序需按约定去重。以上为教学设计，未接真实模型或做服务联调。
