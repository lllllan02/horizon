---
title: "Go 官方源码导读：Singleflight 请求合并"
category: "Go"
tags: ["Go"]
learning_status: pending
created_at: "2026-10-19 17:32:33"
updated_at: "2026-10-19 19:20:51"
source:
  - "https://github.com/golang/sync/blob/master/singleflight/singleflight.go"
  - "https://pkg.go.dev/golang.org/x/sync/singleflight"
  - "https://github.com/golang/sync/blob/v0.17.0/singleflight/singleflight.go"
---

`golang.org/x/sync/singleflight` 提供重复调用抑制机制，**「同一个 Group 中，同 key 的重叠调用可以共享一次执行结果」**，适合减少缓存未命中时对同一资源的重复查询。本篇依据 2026-10-19 查阅的官方在线源码，只选取 `Do` 的正常返回路径，不覆盖全部接口和异常处理。

## 如何登记和等待任务

[Group 与 call](https://github.com/golang/sync/blob/master/singleflight/singleflight.go#L51-L70) 是两个核心结构：`Group` 包含保护 map 的 `sync.Mutex`，map 将 key 映射到 `*call`；`call` 保存 `WaitGroup`、结果和错误，另有重复调用计数与结果通道列表。

[Do](https://github.com/golang/sync/blob/master/singleflight/singleflight.go#L84-L107) 在锁内查找 key。已有任务时，增加重复调用计数，解锁后等待该任务的 `WaitGroup`；没有任务时，创建 `call`，先 `Add(1)` 再登记到 map，随后解锁并执行函数。这使“查找与登记”保持原子性，同时避免耗时函数占住全局锁。

## 结果如何共享，何时可以重新执行

[doCall](https://github.com/golang/sync/blob/master/singleflight/singleflight.go#L133-L191) 先把函数返回值和错误写入 `call`，再在锁内调用 `Done()`，删除仍指向该 `call` 的 map 记录。等待者在 `Wait()` 返回后读取已保存的结果和错误，因此不需要重复执行函数。任务记录被删除后，新的同 key 调用可以重新执行，说明它本身不保留长期缓存。

官方实现还处理 panic、`runtime.Goexit`，并提供 `DoChan` 和 `Forget`。其中 `Forget` 允许后续调用发起新任务，旧任务仍可能继续运行；因此不能把默认的重复抑制描述成任何操作下都绝不出现同 key 的重叠执行。

配套[[assets/singleflight-demo.go|核心实现代码]]参照[官方 v0.17.0 源码](https://github.com/golang/sync/blob/v0.17.0/singleflight/singleflight.go)整理，只展示正常返回流程，省略重复计数、其他接口与异常处理。
