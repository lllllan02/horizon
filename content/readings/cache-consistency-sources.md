---
title: "旁路缓存与失效通知可靠性资料导读"
category: "Redis"
type: article
tags: ["缓存一致性", "事务", "消息队列"]
learning_status: pending
created_at: "2026-10-19 16:55:15"
updated_at: "2026-10-19 16:55:15"
source:
  - "https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside"
  - "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html"
---

微软的 Cache-Aside 文档说明缓存如何按需加载、写入时如何失效，以及一致性限制；AWS 的 Transactional Outbox 文档解释数据库提交与事件发送之间的失败窗口。本篇节选这两部分，用于理解缓存失效与可靠补偿，不覆盖所有缓存模式或 AWS 部署示例。

## 旁路缓存的读写顺序

[Cache-Aside 的 Solution 与 Example](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside#solution) 给出读写流程：读请求先查缓存，未命中再查数据源并回填；写请求先更新数据源，再使对应缓存失效。按需加载让未被读取的数据不必提前缓存，代价是未命中时需要回源。

原文特别解释了顺序：如果先删除缓存、再更新数据库，并发读取可能在数据库更新前拿到旧值并缓存，数据库改完后缓存仍然过时。改成先更新数据库再删除，可以避开这个时序，但原文明确指出 **「Cache-Aside 不保证数据源与缓存的一致性」**，外部写入、复制和多个实例的本地副本都会增加同步困难。缓存有效期需要在旧数据风险和回源开销之间取舍。

根据上述流程还可以推导另一种竞态：缓存未命中后的读请求先取得旧值；写请求随后提交新值并删除缓存；旧读请求最后才回填。数据库提交到删除缓存之间，也仍有命中旧缓存的窗口。这些是对流程的时序推演，不是原文提供的实验结果。

延迟再删除一次可以尝试清理迟到的旧值，但如果旧读请求在最后一次删除后才回填，就仍会失败。因此不能从固定延迟推出强一致性；该判断属于并发时序分析，上述文档未规定延时双删的等待参数。

## 失效通知如何可靠地发出去

[AWS 的 Motivation 与 Implementation](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html#motivation) 用数据库更新后通知下游的场景说明双写风险：提交成功后，进程可能在事件发出前退出；反过来，事件已发出而事务回滚，也会让下游处理不存在的修改。

事务发件箱在同一个数据库事务中修改业务数据并插入待发送事件，一起提交或回滚。后台进程读取已提交事件并发送，发送失败可以重试；发送成功但确认或清理失败时可能重复投递，所以消费者仍需处理重复，依赖顺序的业务也需维护事件顺序。它把「业务数据和发送意图」原子保存，跨系统通知仍是异步过程。

原文还介绍 CDC，即从数据库变更记录捕获修改并驱动通知。将这些思路用于缓存失效，是本篇的应用归纳：事件消费者删除受影响缓存，失败后继续重试；持久化记录、消费进度与失败监控都需可靠维护。它们补偿删除失败或通知丢失，不能自动解决所有旧值回填，也不能消除传播延迟。

2026-10-19 核对上述官方文档；未部署或实测缓存竞态、通知恢复时间与延迟删除参数。
