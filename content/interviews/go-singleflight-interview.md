---
title: "Go 的 Singleflight 是怎么实现的？"
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go"]
learning_status: organized
created_at: "2026-10-19 17:32:33"
updated_at: "2026-10-19 19:20:51"
learning_status_changed_at: "2026-10-19 19:23:36.892"
---

[[go-singleflight-sources|Singleflight]] 的核心是**「把同一个 key、执行期间重叠的调用合并起来」**，只执行一次查询，其他调用等待并共享结果，减少对数据库的重复查询。

实现上，用一个[[go-mutex-interview|互斥锁]]保护 map，保存正在执行的任务，用 key 来识别哪些请求可以共享同一次查询。

一个请求进来后，先加锁查 map。如果没有对应的任务，就创建任务并登记到 map，然后释放锁，执行查询。如果已经有任务，就取到这个任务，释放锁后等待它完成，不再重复查询。

查询结束后，执行者保存结果和错误，通知等待者，并在锁的保护下把任务从 map 中移除。**「等待同一个任务的请求，都能拿到这一次查询的结果和错误」**。之后再有相同 key 的请求进来，就会创建新任务，执行新一轮查询。

执行查询和等待结果时都不占着 map 的锁，所以不同 key 的任务可以并行执行。它本身不缓存结果，只合并执行期间重叠的调用。

[[assets/singleflight-demo.go|核心实现代码]]参照官方源码整理，用中文注释标出任务登记、等待、结果共享与清理，只保留正常返回流程。
