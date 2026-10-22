---
title: "Google SRE：容量判断与服务降级"
category: "服务治理"
tags: ["服务治理", "限流", "过载保护"]
learning_status: pending
created_at: "2026-10-22 12:12:22"
updated_at: "2026-10-22 12:12:22"
source:
  - "https://sre.google/sre-book/handling-overload/"
  - "https://sre.google/sre-book/addressing-cascading-failures/"
---

**过载保护既要控制进入系统的工作量，也要考虑降低单次服务的计算成本。** Google SRE 的这两章分别解释容量判断、客户配额，以及降级如何减少工作。本篇节选这些内容，不覆盖完整负载均衡、客户端自适应节流或级联故障排查。

## 容量不能只看 QPS

[Handling Overload 的 QPS 局限](https://sre.google/sre-book/handling-overload/#the-pitfalls-of-queries-per-second)指出，不同请求需要的资源可能相差很大，同一类请求的成本也会随软件与业务变化。因此，仅用每秒请求数推算容量，可能掩盖实际资源压力；应同时考虑 CPU、内存等资源，不能把某次测得的 QPS 当作固定容量。

同章的 [Per-Customer Limits](https://sre.google/sre-book/handling-overload/#per-customer-limits)按与客户约定的用量分配配额，避免一个客户超用时影响其他客户。这里的配额可以按资源成本计量，限流的目的也包括公平分配共享资源。

## 降级减少完成请求所需的工作

[Handling Overload 开篇](https://sre.google/sre-book/handling-overload/)给出两种降级：搜索只处理一部分候选，以及使用可能较旧、但访问成本更低的本地结果。收益来自减少计算或依赖访问，代价是质量或新鲜度下降；极端过载时，简化响应也可能无法完成，仍需拒绝。

[Load Shedding and Graceful Degradation](https://sre.google/sre-book/addressing-cascading-failures/#load-shedding-and-graceful-degradation)进一步区分：丢弃部分流量是在减少请求量，降级则减少服务一次请求所需的工作，例如只搜索内存缓存子集，或使用更快但较不精确的排序。

原文要求事先确定触发指标、降级动作和实现层级；指标可包括 CPU、延迟、队列长度、线程数，触发可自动或人工进行。降级路径平时很少执行，容易失效，需要演练、监控以及可调整的开关，复杂反馈也可能引发新的问题。

按这些机制用于业务设计时，建议提前约定哪些质量可以放宽、哪些正确性必须保留，并在压力缓解后小范围恢复、观察再扩大。这是工程建议，原文没有规定统一的降级恢复状态机。

资料于 2026-10-22 核对官方在线原文，未执行压测或故障演练。
