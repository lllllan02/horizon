---
title: "Redis 锁竞争与原子脚本资料导读"
category: "Redis"
type: article
tags: ["分布式锁", "Lua", "性能"]
learning_status: pending
created_at: "2026-10-20T21:30:20+08:00"
updated_at: "2026-10-20T21:30:20+08:00"
source:
  - "https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/"
  - "https://redis.io/docs/latest/develop/programmability/eval-intro/"
---

Redis 官方文档说明：**「竞争锁需要控制重试，原子脚本可以减少网络交互，但租约和脚本都有保证范围」**。本篇依据 2026-10-20 的在线文档，节选与锁性能优化有关的机制，不展开完整 Redlock 算法，也不提供性能测量结果。

## 竞争失败后的处理

[Retry on Failure](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/#retry-on-failure) 在 Redlock 场景要求随机延迟后重试，打散同时争抢；未取得多数锁时，应尽快释放部分已取得的锁，避免其他客户端只能等待过期。文中的多实例并行通信降低的是协议往返等待，不代表同一资源可被多个持有者同时修改。

## 释放与租约的边界

[单实例说明](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/#correct-implementation-with-a-single-instance)要求原子地比较所有者 token 后再删除，避免旧持有者误删新锁。租约过期后，旧进程仍可能执行；[一致性说明](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/#disclaimer-about-consistency)提醒不能以进程存活推断锁仍有效，并提出使用 fencing token。仅安全删除不能阻止旧持有者写外部资源。

## 原子操作能替代哪部分锁

[Scripting with Lua](https://redis.io/docs/latest/develop/programmability/eval-intro/)开篇指出：脚本在 Redis 内原子执行，可以组合读取、条件判断和修改，并减少网络交互；执行期间会阻塞其他客户端命令。因此，短脚本可替代只保护 Redis 内部状态的应用层加锁流程，不能把外部数据库更新也纳入同一次原子操作，长脚本还可能增加其他请求的等待。这些替代条件是结合官方执行语义作出的应用归纳，未做压测。
