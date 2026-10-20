---
title: "Go、Node 与 Redis：取消通知、停止确认和条件提交"
category: "Agent"
tags: ["Agent", "取消", "Go"]
learning_status: pending
created_at: "2026-10-20T14:47:16+08:00"
updated_at: "2026-10-20T14:47:16+08:00"
source:
  - "https://pkg.go.dev/context#CancelFunc"
  - "https://nodejs.org/api/http.html#httprequesturl-options-callback"
  - "https://nodejs.org/api/child_process.html#subprocesskillsignal"
  - "https://redis.io/docs/latest/develop/pubsub/#delivery-semantics"
  - "https://www.postgresql.org/docs/18/transaction-iso.html#XACT-READ-COMMITTED"
---

这些官方文档分别说明：**取消通知、调用方结束等待、执行方实际退出是不同的确认结果。** 本文只摘取与取消传播、通知可靠性及结果提交有关的段落；跨组件如何组合为 Agent 停止方案，属于设计归纳。

## Go 与 Node 的取消只保证到各自边界

Go 的 [Context 文档](https://pkg.go.dev/context#CancelFunc)要求沿调用链传递 Context，父 Context 取消也会取消派生的子 Context。`CancelFunc` 通知操作放弃工作，但不等待工作停止；goroutine 需要观察 `Done()`，或调用支持 Context 的接口响应取消。调用 `cancel()` 后仍需另外协调退出确认。

Node 的 [HTTP 文档](https://nodejs.org/api/http.html#httprequesturl-options-callback)说明，向请求传入 `AbortSignal` 后触发 `abort()`，效果等同于销毁请求；只设置 `timeout` 不会自动中止请求。这些是客户端请求的行为，不能据此推断远端模型已停止计算或业务已回滚。

[子进程文档](https://nodejs.org/api/child_process.html#subprocesskillsignal)说明，`kill()` 成功与 `killed=true` 表示信号已成功发送，不能证明进程已经退出。Linux 下终止父进程也不保证所有后代同时停止。因此执行器还需观察退出并检查任务所属进程范围，具体清理方式依运行环境而定。

## Redis 通知可能丢失

Redis [Pub/Sub 投递语义](https://redis.io/docs/latest/develop/pubsub/#delivery-semantics)是至多一次：订阅者断线或无法处理时，消息会丢失，也不会补发。由此可归纳：取消状态应可回查，Pub/Sub 用来加快唤醒；不能把收到一次广播作为取消生效的唯一条件。使用 Redis key 保存状态时，持久化、过期和故障后的恢复保证仍需单独设计。

## 用条件提交处理取消与写回竞争

PostgreSQL 18 的 [Read Committed 说明](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-READ-COMMITTED)指出：竞争更新同一行时，后来的更新会等待前一个事务结束；若前者提交，后者会在更新后的行上重新检查 `WHERE` 条件。

基于这一语义，可以设计按运行 ID、执行版本和运行状态进行条件提交。取消原子修改同一行的状态或版本；结果提交时，只有条件仍匹配才更新，未更新任何行就不能把该结果作为当前运行的成功结果。若结果和进度分存在其他表，相关写入也应受同一事务约束。恢复时递增执行版本，可阻止旧执行在状态再次变为「运行中」后提交。

这是利用数据库条件更新形成的设计建议。先读取 Redis 状态、再无条件写数据库，并没有上述原子边界；本地事务也不能覆盖远端邮件、支付或其他外部副作用。

资料于 2026-10-20 核对；读取的文档版本为 Go 1.27.3、Node.js 26.12.0、PostgreSQL 18，Redis 为在线文档。未执行取消、进程清理或并发写回实验，模型供应商的远端停止能力未核实。
