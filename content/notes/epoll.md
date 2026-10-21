---
title: "epoll"
aliases: ["epoll(7)"]
category: "操作系统"
parent: io-multiplexing
tags: ["IO多路复用"]
learning_status: organized
created_at: "2026-10-20T19:46:45+08:00"
updated_at: "2026-10-20T19:46:45+08:00"
learning_status_changed_at: "2026-10-20T19:54:52.740+08:00"
---

epoll 是[[io-multiplexing|IO 多路复用]]机制，在内核中维护「**监听集合和就绪列表**」。当大量连接长期被监听、每次只有少量活跃时，它能复用监听集合，省去像[[select|select]]、[[poll|poll]]那样每轮重新提交完整集合的工作。

应用用 `epoll_ctl` 增删改[[linux-io-sources#epoll|关注项]]，用 `epoll_wait` 获取就绪事件，再处理返回的连接；两类操作分开，未变化的关注项可以继续保留在内核中。

![[assets/io-epoll.png|680]]

epoll 支持[[epoll-trigger-interview|水平触发和边缘触发]]。它返回就绪事件，实际数据仍由应用读写；性能取决于负载和处理方式，不能把整个过程笼统视为恒定时间。
