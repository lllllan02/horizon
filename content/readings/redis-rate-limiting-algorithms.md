---
title: "Redis：限流算法的窗口、突发与排队"
category: "服务治理"
tags: ["Redis", "限流", "过载保护"]
learning_status: pending
created_at: "2026-10-19T16:19:44+08:00"
updated_at: "2026-10-19T16:19:44+08:00"
source: "https://redis.io/tutorials/howtos/ratelimiting/"
---

**「统计时间范围、额度积累方式，以及是否延迟转发，共同决定限流算法怎样处理突发。」** 本文节选 Redis 官方教程的算法机制与边界，不覆盖项目安装和完整代码；按 2026-10-19 页面核对，未运行示例。

## 固定窗口与滑动窗口

[固定窗口](https://redis.io/tutorials/howtos/ratelimiting/#1-fixed-window-counter)为互不重叠的时间区间分别计数，状态少，但窗口末尾与下个窗口开头可能集中使用两份额度。

[滑动日志](https://redis.io/tutorials/howtos/ratelimiting/#2-sliding-window-log)保存已放行请求的准确时间，移除过期记录、计数，再决定是否加入新记录，消除了固定边界重置的问题，代价是逐请求存储。[滑动计数](https://redis.io/tutorials/howtos/ratelimiting/#3-sliding-window-counter)只保留前后两个窗口，按前一窗口仍重叠的时间比例加权，节省状态，但估计可能多算或少算。

## 令牌桶的补充与突发

[令牌桶](https://redis.io/tutorials/howtos/ratelimiting/#4-token-bucket)按「原余额 + 经过时间 × 补充速率」计算令牌，并以桶容量封顶，再检查并扣减。容量保存突发额度，补充速率约束长期平均流量。

## 漏桶的两种语义

[排队式漏桶](https://redis.io/tutorials/howtos/ratelimiting/#5-leaky-bucket)延迟转发请求、平滑输出，队满拒绝；计量式仅减少虚拟水位并判断容量，获准请求立即通过。后者不保证匀速；这是对原文水位判定流程的归纳。教程的排队模式只返回延迟，实际等待与转发仍由调用方落实。

## 为什么判定需要原子执行

多个请求可能同时读到尚未用完的额度，分别放行后共同超限。教程用 [Lua 脚本](https://redis.io/tutorials/howtos/ratelimiting/#why-lua-scripts)把读取、判定与更新作为一次不可交错的操作；单条计数命令原子，不代表整套判定已经原子。
