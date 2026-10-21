---
title: "聊一聊 Go 的互斥锁和读写锁"
category: "Go"
parent: go-interview-hub
tags: ["面试", "Go"]
learning_status: organized
created_at: "2026-10-19T16:12:35+08:00"
updated_at: "2026-10-19T16:12:35+08:00"
learning_status_changed_at: "2026-10-19T16:18:34.657+08:00"
---

这两种锁都是用来保护共享数据的，避免多个 [[coroutine#Go 的 goroutine|goroutine]] 同时访问时出问题。

互斥锁就是 `sync.Mutex`，用 `Lock` 和 `Unlock`。可以理解成**「不管读还是写，一次只让一个 goroutine 进来，其他人先等着」**。

读写锁是 `sync.RWMutex`，读的时候用 `RLock/RUnlock`，写的时候用 `Lock/Unlock`。它允许大家一起读，但只要有人在写，其他读写都得等，也就是**「读读并行，读写、写写互斥」**。所以读多写少的时候，可以考虑用它。

不过，**「读写锁不一定更快」**，因为它还得维护读者数量。如果每次读的内容很少、很快，可能用互斥锁反而更划算，具体可以压测比较。另外，如果已经有写者在等，后来的读者也得排队，避免一直有人读，写者始终拿不到锁。
