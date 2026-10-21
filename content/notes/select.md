---
title: "select"
aliases: ["select(2)"]
category: "操作系统"
parent: io-multiplexing
tags: ["IO多路复用"]
learning_status: organized
created_at: "2026-10-20T19:46:45+08:00"
updated_at: "2026-10-20T19:46:45+08:00"
learning_status_changed_at: "2026-10-20T19:52:28.325+08:00"
---

select 是[[io-multiplexing|IO 多路复用]]接口，用「**位图**」表示监听集合。应用把关心的多个连接交给内核统一等待，让一个线程可以处理这些连接的读写事件。

[[linux-io-sources#select|描述符集合]]中的每一位对应一个文件描述符。调用时标记关心哪些描述符，返回时集合只保留就绪项，应用再检查哪些位被置上。下图只示意可读事件：

![[assets/io-select.png|680]]

集合会被返回结果修改，因此每轮等待前要重新准备。glibc 的 `fd_set` 固定大小为 `FD_SETSIZE=1024`，可放入的描述符编号必须小于 1024；这个限制不代表整个进程最多只能打开 1024 个连接。
