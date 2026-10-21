---
title: "进程、线程与协程官方资料导读"
category: "计算机基础"
tags: ["Go", "并发", "调度"]
learning_status: pending
created_at: "2026-10-20T19:21:23+08:00"
updated_at: "2026-10-20T22:51:31+08:00"
source:
  - "https://learn.microsoft.com/en-us/windows/win32/procthread/processes-and-threads"
  - "https://learn.microsoft.com/en-us/windows/win32/procthread/about-processes-and-threads"
  - "https://learn.microsoft.com/en-us/windows/win32/ipc/interprocess-communications"
  - "https://kotlinlang.org/docs/coroutines-basics.html"
  - "https://go.dev/doc/faq#goroutines"
  - "https://go.dev/doc/faq#parallel"
  - "https://learn.microsoft.com/en-us/windows/win32/procthread/context-switches"
  - "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-mechanisms.pdf"
  - "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf"
---

「**进程提供资源与地址空间，线程承担操作系统调度的执行，协程通过程序或运行时复用线程。**」本文节选 Windows、Kotlin 和 Go 官方资料，以及 OSTEP 教材中与进程、线程、协程及上下文切换相关的内容，不覆盖全部操作系统或协程实现。

## 进程与线程

[Processes and Threads](https://learn.microsoft.com/en-us/windows/win32/procthread/processes-and-threads)将进程概括为正在执行的程序。[About Processes and Threads](https://learn.microsoft.com/en-us/windows/win32/procthread/about-processes-and-threads)进一步说明它提供程序执行所需的资源，包括虚拟地址空间、可执行代码、系统对象句柄及至少一个执行线程。线程是进程内可被调度执行的实体：同一进程的线程共享虚拟地址空间和系统资源，各自保留栈、寄存器等执行上下文。

这一区分说明了资源归属和执行状态的关系：多个线程可以在同一份进程资源上工作，但仍须分别保存执行位置和调用状态。原文以 Windows 为背景，本文不将其线程环境块等具体结构推广到其他系统，也不据此给出创建、切换开销的固定比例。

[进程间通信说明](https://learn.microsoft.com/en-us/windows/win32/ipc/interprocess-communications)列出映射、管道和套接字等通信方式。共享内存通过把同一份内存映射到不同进程各自的地址空间实现；因此，进程通常具有独立地址空间，与显式共享部分内存并不矛盾。

## 上下文切换

[OSTEP 第 6 章第 9 页的 Saving and Restoring Context](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-mechanisms.pdf#page=9)说明：任务暂停后要能够继续运行，就必须保留执行现场。调度器决定更换任务时，切换代码保存当前任务的通用寄存器、程序计数器和内核栈指针等状态，再恢复另一个任务的状态。**仅进入内核不等于更换任务**：系统调用或定时器中断让操作系统取得控制权后，调度器也可以决定继续运行原任务。

[Windows 的 Context Switches](https://learn.microsoft.com/en-us/windows/win32/procthread/context-switches)按保存当前线程、选择就绪线程、恢复状态并继续执行描述切换过程。它列出三类常见原因：时间片耗尽且有同等或更高优先级的就绪线程；更高优先级线程就绪；当前线程需要等待。等待输入或同步对象的线程，在重新就绪前不会获得 CPU。该页描述 Windows 的优先级调度，不能将其具体选择规则视为所有系统的统一算法。

[OSTEP 第 26 章第 1 页](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf#page=1)进一步区分线程切换与进程切换：同一进程内的线程也需要保存和恢复寄存器，但它们共享地址空间，因此无需切换所用的地址空间和页表。以上 OSTEP 内容依据 Version 1.10，具体需要保存哪些状态取决于体系结构与实现，未做切换开销实测。

## 协程的挂起与恢复

[Kotlin 的 Coroutines basics](https://kotlinlang.org/docs/coroutines-basics.html)将协程定义为可挂起的计算：执行可以暂停并在之后继续，暂停时线程可以执行其他协程。Kotlin 协程能否在另一线程恢复，取决于调度器。本文只节选这一定义与线程关系，不总结该教程的全部用法。

结合下文 Go 的抢占与多线程调度，可以归纳：协程保留可继续执行的状态，但是否跨线程、支持抢占或多核并行，要看具体实现，不能仅凭“协程”这一名称断定。

## Go 的 goroutine

[Why goroutines instead of threads?](https://go.dev/doc/faq#goroutines)解释，Go 把独立执行的函数复用到一组操作系统线程上，运行时负责调度；线程因阻塞系统调用无法继续执行时，其他可运行的 goroutine 仍可交给别的线程执行。程序员不必为每个并发任务管理一个操作系统线程。

goroutine 使用初始较小、可自动增缩的栈，使大量并发任务可以在较少内存中共存。原文用几 KB 描述栈的量级，不能将其视为所有版本和平台的固定值，也不能当作 goroutine 的全部内存占用。具体调度和栈机制由已有的[[go-gmp-sources|GMP 源码导读]]承接。

[并发与多核执行相关问答](https://go.dev/doc/faq#parallel)进一步说明，「**并发提供了并行的可能，实际收益还取决于任务是否能并行分解**」。同步与通信开销可能抵消更多 CPU 带来的收益。`GOMAXPROCS` 控制普通 Go 代码的同时执行规模，线程总数可以超过它；goroutine 数量多不等于全部同时执行。

以上依据 2026-10-20 查阅的在线文档，未固定 Go 发布版本，未做性能实测。
