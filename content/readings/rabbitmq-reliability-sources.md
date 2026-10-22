---
title: "RabbitMQ：确认、持久化与重复投递导读"
category: "消息队列"
type: article
tags: ["消息队列", "RabbitMQ", "重试", "幂等"]
learning_status: pending
created_at: "2026-10-22 11:24:39"
updated_at: "2026-10-22 11:24:39"
source:
  - "https://www.rabbitmq.com/docs/reliability"
  - "https://www.rabbitmq.com/docs/confirms"
---

RabbitMQ 将可靠投递分给生产者、Broker 和消费者共同承担：确认用于判断责任是否转交，失败后重发仍可能造成重复。本篇节选 RabbitMQ 4.4 官方指南的 AMQP 0-9-1 确认、数据保存和故障恢复部分，不覆盖所有协议与队列类型。

## 生产者确认与重发

[Publisher Confirms](https://www.rabbitmq.com/docs/confirms#publisher-confirms)与消费确认分别覆盖「生产者到 Broker」和「Broker 到消费者」，两者独立。「**生产者拿到确认不代表消费者已经完成业务**」，写入 TCP Socket 也不代表消息已被 Broker 接受。

[生产者侧数据安全](https://www.rabbitmq.com/docs/reliability#data-safety-on-the-publisher-side)要求恢复连接后重发尚未收到确认的消息。Broker 可能已经接受消息、只是确认在途中丢失，因此「**重发会带来重复**」；消费者需要支持幂等处理。

[无法路由的消息](https://www.rabbitmq.com/docs/confirms#when-will-published-messages-be-confirmed-by-the-broker)也可能得到发送确认。若业务要求消息必须进入队列，还需检查路由结果：设置 `mandatory` 后，无法路由时 Broker 会先发 `basic.return`，再发确认；生产者必须处理返回事件。

## 确认在什么保存条件后返回

[Broker 侧数据安全](https://www.rabbitmq.com/docs/reliability#data-safety-on-the-rabbitmq-side)要求重要数据采用持久队列等合适的队列类型，并将消息发布为持久消息，避免节点重启后丢失。

[确认时机](https://www.rabbitmq.com/docs/confirms#when-will-published-messages-be-confirmed-by-the-broker)还取决于队列类型：路由到持久队列的持久消息，在持久化到磁盘后确认；Quorum Queue 则需法定数量副本接受并向 Leader 确认。仅仅部署集群不意味着每个队列都有消息副本，复制能力由队列类型决定。

## 消费完成与再次投递

[Acknowledgements and Confirms](https://www.rabbitmq.com/docs/reliability#acknowledgements-and-confirms)要求应用完成所需处理后再确认。手动确认模式下，[连接或 Channel 关闭](https://www.rabbitmq.com/docs/confirms#automatic-requeueing)会使未确认的投递重新入队；如果业务已完成、确认尚未被 Broker 接收，就可能再次投递。

[拒绝与重新入队](https://www.rabbitmq.com/docs/confirms#negative-acknowledgement-and-requeuing-of-deliveries)可以安排重试；不重新入队时，有配置的消息可进入死信交换机，否则可能直接丢弃。立即反复入队可能形成高成本重投循环，因此可靠处理还需应用安排重试与失败恢复，死信也不等于业务已完成。

以上依据官方文档核对，未进行断网、节点故障或重复投递实验。
