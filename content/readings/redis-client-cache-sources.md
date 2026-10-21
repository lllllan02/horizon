---
title: "Redis 客户端缓存与失效通知资料导读"
category: "Redis"
type: article
tags: ["缓存", "缓存一致性"]
learning_status: pending
created_at: "2026-10-20 21:25:08"
updated_at: "2026-10-20 21:25:08"
source: "https://redis.io/docs/latest/develop/reference/client-side-caching/"
---

Redis 官方 Client-side caching reference 说明：**把热点查询结果保存在应用内存中，可以减少 Redis 请求，但需要处理本地副本的失效。**以下节选收益、适用数据与失效边界，不覆盖完整协议和客户端接入。

## 本地缓存为何能分流

原文开篇说明，应用缓存查询结果后，后续命中可直接从本地内存返回，省去网络访问。[What to cache](https://redis.io/docs/latest/develop/reference/client-side-caching/#what-to-cache) 建议优先缓存频繁访问、更新不过于频繁的数据；很少读取或持续变化的数据，复用收益较低。

## 失效通知如何协调副本

原文先指出，本地副本可能在源数据更新后继续返回旧值，可以按业务容忍度设置 TTL。Redis 6 引入的 [Tracking](https://redis.io/docs/latest/develop/reference/client-side-caching/#the-redis-implementation-of-client-side-caching) 在默认模式下记录客户端读过的 key；key 修改、过期或被淘汰时，通知可能持有副本的客户端删除本地条目。使用前须确认客户端支持。

通知也有失败边界：[失效连接断开时](https://redis.io/docs/latest/develop/reference/client-side-caching/#what-to-do-when-losing-connection-with-the-server)，客户端应清空本地缓存；原文还建议设置最大 TTL 和内存上限。通知存在传播时间，不能由此推出强一致性。

2026-10-20 核对官方文档；未部署或实测分流比例与失效延迟。
