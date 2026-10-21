---
title: "Linux IO 多路复用手册导读"
category: "操作系统"
tags: ["IO多路复用"]
learning_status: pending
source:
  - "https://man7.org/linux/man-pages/man2/select.2.html"
  - "https://man7.org/linux/man-pages/man2/poll.2.html"
  - "https://man7.org/linux/man-pages/man7/epoll.7.html"
created_at: "2026-10-20 19:43:28"
updated_at: "2026-10-20 19:43:28"
---

Linux 的[[select|select]]、[[poll|poll]]和[[epoll|epoll]]用于等待文件描述符的就绪事件，再由应用执行读写。这里节选三份 Linux man-pages 中的集合组织、接口使用和触发语义，核对于 2026-10-20；不覆盖全部参数、错误处理及内核源码，未做性能实测。

## select

[select(2) 的 DESCRIPTION 与 BUGS](https://man7.org/linux/man-pages/man2/select.2.html)说明，调用者通过 `fd_set` 分别传入关心读、写及异常事件的描述符集合。返回时，集合被改成就绪结果，应用用 `FD_ISSET` 检查具体描述符；循环调用前要重新准备集合。

glibc 的 `fd_set` 使用固定大小位图，`FD_SETSIZE` 为 1024，因此可放入的文件描述符编号必须小于 1024。这是该接口在 glibc 中的表示限制，不是 Linux 内核规定整个进程最多只能打开 1024 个连接。

## poll

[poll(2) 的 DESCRIPTION 与 EXAMPLES](https://man7.org/linux/man-pages/man2/poll.2.html)使用 `pollfd` 数组表示监听集合，每项包含描述符 `fd`、关注事件 `events` 和返回事件 `revents`。应用每次传入数组，返回后检查各项的 `revents`，判断哪些对象可以处理。

数组避免了 `fd_set` 的固定大小限制，但监听数量仍受 `RLIMIT_NOFILE` 等资源限制；每次传入整个数组、遍历返回项的使用方式仍然存在。

## epoll

[epoll(7) 的 DESCRIPTION](https://man7.org/linux/man-pages/man7/epoll.7.html)将内核中的状态分成关注集合与就绪列表。应用通过 `epoll_create1` 创建实例，用 `epoll_ctl` 增删改关注项，通过 `epoll_wait` 获取就绪事件。

关注集合跨等待调用保留，不需要像 select、poll 一样每次重新提交完整集合；应用按返回的就绪项处理。这个机制适合关注对象很多、每次只有部分就绪的场景，不能据此推断任何负载下都更快，或把整个处理过程视为恒定时间。

就绪通知表示可以尝试相应操作，应用仍须调用 `read`、`write` 等完成读写；收到一次通知不代表完整请求已经接收完毕。

## epoll 的触发方式

[epoll(7) 的 Level-triggered and edge-triggered 小节](https://man7.org/linux/man-pages/man7/epoll.7.html)区分两种通知方式：默认的水平触发在就绪条件持续成立时仍可返回事件；边缘触发主要在状态变化时通知，通过 `EPOLLET` 启用。

手册解释了边缘触发下只读取部分数据的风险：接收缓冲区仍有数据，但应用再次等待时可能没有新的事件，因而迟迟不处理剩余内容。建议使用非阻塞描述符，并在读写返回 `EAGAIN` 后再等待下一次事件。读取还需处理 EOF 和错误，不能把所有结束条件都视为暂时无数据。
