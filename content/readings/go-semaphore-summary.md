---
title: "Go：用加权信号量限制并发资源占用"
category: "Go"
tags: ["并发", "过载保护"]
learning_status: pending
created_at: "2026-10-18T23:47:18+08:00"
updated_at: "2026-10-18T23:47:18+08:00"
source: "https://pkg.go.dev/golang.org/x/sync/semaphore"
---

Go 的 [`golang.org/x/sync/semaphore`](https://pkg.go.dev/golang.org/x/sync/semaphore)用加权信号量[[concurrency-control|限制共享资源的同时占用量]]。每个任务先申请权重，工作结束后释放；各任务已占用的权重之和不能超过容量上限。

## 申请、等待与释放

`NewWeighted(n)` 设置总容量；`Acquire(ctx, weight)` 在容量不足时等待，直到有足够容量或上下文结束。申请失败返回上下文错误，并保持信号量不变；`TryAcquire` 则不等待，直接报告能否取得名额。成功取得的额度通过 `Release` 归还。[Weighted API](https://pkg.go.dev/golang.org/x/sync/semaphore#Weighted)

取消等待申请与终止已运行任务是不同责任：申请成功后，任务仍需处理自己的取消和收尾，信号量负责的是额度管理。

## 官方示例把等待放在哪里

[WorkerPool 示例](https://pkg.go.dev/golang.org/x/sync/semaphore#example-package-WorkerPool)先在提交循环中取得名额，再启动 goroutine，并在任务结束时释放。名额耗尽时，循环暂停派生下一项工作，已有任务结束后再继续。

由这一结构可知，如果先为所有任务创建 goroutine，再让它们等待名额，只能限制正在工作的数量，不能同时限制等待 goroutine 的数量。这是对示例执行顺序的归纳；信号量本身也没有替应用规定队列上限或每秒启动速率。

按 2026-10-18 在线包文档与示例整理，未运行示例，也未据其示例数值推定服务容量。
