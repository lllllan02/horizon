---
title: "poll"
aliases: ["poll(2)"]
category: "操作系统"
parent: io-multiplexing
tags: ["IO多路复用"]
learning_status: organized
created_at: "2026-10-20 19:46:45"
updated_at: "2026-10-20 19:46:45"
learning_status_changed_at: "2026-10-20 19:52:54.777"
---

poll 是[[io-multiplexing|IO 多路复用]]接口，用「**数组**」表示监听集合。相比[[select|select]]的固定大小位图，它可以按需要组织数组，避开描述符编号小于 1024 的表示限制。

[[linux-io-sources#poll|数组中的每一项]]保存描述符 `fd`、关心的事件 `events` 和返回的事件 `revents`。应用每次传入整个数组，返回后遍历 `revents`，找出可以处理的连接。下图以可读事件 `POLLIN` 为例：

![[assets/io-poll.png|680]]

poll 仍需要每次传入并检查整个数组，监听数量也受系统资源限制；连接数量很多时，这部分工作不会因为只有少量连接就绪而自动消失。
