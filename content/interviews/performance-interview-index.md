---
title: "性能排查与优化面试题"
category: "性能排查"
parent: interview-hub
tags: ["面试", "性能排查"]
type: overview
learning_status: organized
created_at: "2026-10-19T10:51:27+08:00"
updated_at: "2026-10-20T19:46:37+08:00"
learning_status_changed_at: "2026-10-21T10:10:15.900+08:00"
---

围绕请求耗时、系统瓶颈与流量控制整理面试题，串起现象确认、瓶颈定位、优化处理、过载保护与效果验证。

## 通用排查

- [[api-latency-causes-interview|哪些常见问题会导致接口响应慢？]]
- [[api-latency-interview|接口响应慢，怎么排查和优化？]]

## 并发与锁

- [[distributed-lock-performance-interview|高并发下，如何降低分布式锁的性能开销？]]

## 流量与过载保护

- [[rate-limiting-interview|怎么做限流？有哪些常见的限流算法？]]
- [[service-degradation-interview|降级是做什么的，大概怎么做？]]

## 项目案例

以下题目归属[[personal-output-index|个人产出]]，可结合通用排查思路阅读：

- [[contest-bottleneck-interview|比赛开赛时出现瞬时洪峰，你们是怎么定位瓶颈的？]]
- [[db-connection-wait-interview|你们怎么确认耗时主要花在等待数据库连接上？]]
