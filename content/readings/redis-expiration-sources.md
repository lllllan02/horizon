---
title: "Redis 过期机制官方资料导读"
category: "Redis"
type: article
tags: ["Redis", "过期机制"]
learning_status: pending
created_at: "2026-10-19 10:35:33"
updated_at: "2026-10-19 10:35:33"
source:
  - "https://redis.io/docs/latest/commands/expire/"
  - "https://redis.io/docs/latest/commands/expireat/"
  - "https://github.com/redis/redis/blob/8.0/src/expire.c"
  - "https://github.com/redis/redis/blob/8.0/src/server.c"
---

Redis 为 key 记录绝对到期时间，通过访问时检查和主动过期清理共同处理过期数据。到期后的读取结果与实际内存回收时间需要区分。本篇节选官方命令文档与 Redis 8.0 源码，只覆盖 key 过期的设置、清理和时间预算，不展开复制、持久化与 Hash 字段过期。

## 时长最终转换为到期时间

[`EXPIRE key seconds`](https://redis.io/docs/latest/commands/expire/) 接受剩余有效时长；[`EXPIREAT key unix-time-seconds`](https://redis.io/docs/latest/commands/expireat/) 接受以秒为单位的 Unix 时间戳。官方 [Expires and persistence](https://redis.io/docs/latest/commands/expire/#expires-and-persistence) 说明，Redis 内部将到期信息保存为绝对 Unix 时间戳，Redis 2.6 起使用毫秒精度。

因此，设置 60 秒有效期，相当于记录「当前时间加 60 秒」所对应的时间点。实例停止运行时，期限仍然经过；判断过期依赖系统时钟，系统时间大幅跳变也会影响结果。

## 访问时检查与主动清理相互补充

[How Redis expires keys](https://redis.io/docs/latest/commands/expire/#how-redis-expires-keys) 区分被动和主动两条路径：访问 key 时发现它已经过期，就执行过期处理；对于再也没人访问的 key，Redis 周期性地从有过期时间的 key 中抽查，删除已到期项。只靠访问触发，冷数据可能长期占内存；频繁检查全部 key 则会增加 CPU 开销。

官方文档将主动检查概括为随机抽查；Redis 8.0 的 [`activeExpireCycle`](https://github.com/redis/redis/blob/8.0/src/expire.c) 实现采用分批增量扫描。理解机制时应抓住「分批检查、只删除过期项」，不把随机理解成随机删除有效数据，也不假定所有版本采用相同抽样细节。

## 清理预算与内存回收延迟

[`server.c`](https://github.com/redis/redis/blob/8.0/src/server.c) 中，`databasesCron` 调用常规主动过期周期，事件循环的 `beforeSleep` 还可触发快速周期。这些检查由主线程调度；自动清理不等于另有一个独立扫描线程。

[`activeExpireCycle`](https://github.com/redis/redis/blob/8.0/src/expire.c) 会在本批过期比例较高时继续检查，但设有时间预算，达到预算后让出执行时间，后续再继续。这样限制清理对请求处理的影响，代价是大量 key 到期时可能出现积压：部分数据已经逻辑过期，尚未从内存中清除。正常读取仍会检查期限，不能因物理删除延迟而把它当作有效数据返回。

2026-10-19 核对上述文档及 8.0 分支源码；分支链接未固定到提交。本篇未实测清理延迟或 CPU 开销，也不据此推断任意负载下的回收速度。
