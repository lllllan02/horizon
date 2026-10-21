---
title: "Go 语言中内存泄漏的常见原因是什么？"
aliases: ["Go 内存泄露的常见原因"]
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go", "内存管理"]
learning_status: organized
created_at: "2026-10-20 20:05:17"
updated_at: "2026-10-20 20:05:17"
learning_status_changed_at: "2026-10-20 21:02:44.763"
---

Go 有 GC，但仍然可能发生[[memory-leak|内存泄漏]]：**业务已经不用的内存，只要仍被引用，GC 就无法回收。** 常见原因可以从三个方向来看：

1. **「对象被长期引用」**：全局 map、缓存或历史记录没有及时清理，保留了过期数据；另外，长期保留[[go-memory-retention-sources#小片段保留大块内存|大切片或大字符串的一小部分]]，也可能让整块底层内存无法回收。
2. **「goroutine 无法退出」**：比如下游不再接收，发送方却一直阻塞在 Channel 上，或者任务没有响应取消。goroutine 自身占用资源，它[[go-pipelines-summary#协程需要自行退出|仍持有的对象引用也会阻止回收]]，需要设计退出路径。
3. **「生命周期清理遗漏」**：派生 [[go-context-interview|Context]] 后，没有及时调用 `cancel()`，可能让子 Context 和关联资源保留过久；HTTP 响应 Body 等资源也需要按约定关闭。[[go-memory-retention-sources#取消与资源清理|资源泄漏可能伴随内存滞留]]，但不能把所有未关闭资源都直接等同于堆内存泄漏。

判断时要确认数据是否已经没有用途。**仍在处理的请求太多、任务积压导致内存增长，也可能只是容量问题**，需要和[[go-oom-interview|内存溢出及其排查]]区分。
