---
title: "Google SRE：资源、排队与重试怎样放大故障"
category: "性能排查"
type: article
tags: ["性能排查", "过载保护", "重试"]
learning_status: pending
created_at: "2026-10-20 18:39:01"
updated_at: "2026-10-20 18:39:01"
source: "https://sre.google/sre-book/addressing-cascading-failures/"
---

**局部变慢可能通过资源占用、排队和重试继续扩大。** 本篇节选 Google SRE 第 22 章的资源耗尽、队列、重试与期限部分，不覆盖全章故障恢复和测试策略。

## 资源占用怎样相互影响

[Resource Exhaustion](https://sre.google/sre-book/addressing-cascading-failures/#resource-exhaustion)指出，CPU 不足会拖慢请求；请求停留更久，又会增加在途请求与内存占用。原文以 Java 为例：GC 消耗 CPU，使处理变慢、内存压力增加，进而增加 GC 开销。具体的 GC 行为与影响仍取决于运行时和负载。

可用内存减少还可能降低缓存命中率，使更多请求进入后端。因而后端过载也可能是上游资源变化的后果。

## 排队也计入延迟

[Queue Management](https://sre.google/sre-book/addressing-cascading-failures/#queue-management)用线程池前的队列说明：请求进入后尚未执行，也在消耗时间和内存。原文示例中，执行需 100ms，队列长度为线程数的十倍且已满时，总耗时可达约 1.1s。只测实际执行会漏掉主要等待。

## 等待与重试为何加重过载

[Latency and Deadlines](https://sre.google/sre-book/addressing-cascading-failures/#latency-and-deadlines)说明，上游等待下游回复期间仍占用资源，过长的期限会延长占用。[Retries](https://sre.google/sre-book/addressing-cascading-failures/#retries)进一步说明，重试会增加负载；多层各自重试还可能使底层调用次数按各层尝试次数相乘。

原文建议限制重试与总期限、使用带随机性的退避，并传播期限与取消。本文未做性能实测，不能据此判断某个线上接口的实际根因。
