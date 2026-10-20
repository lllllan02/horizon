---
title: "Agent 面试题"
category: "Agent"
parent: interview-hub
tags: ["面试", "Agent"]
type: overview
learning_status: pending
created_at: "2026-10-18T23:14:14+08:00"
updated_at: "2026-10-20T15:54:42+08:00"
---

围绕 Agent 开发的求职动机、执行模式、工具选择、协作通信、用户交互、效果评测与服务运行问题整理面试题与回答。

## 求职动机

- [[agent-career-motivation|为什么想做 Agent 开发？]]

## 协作与通信

- [[agent-delegation-interview|什么任务值得拆给多个 Agent？]]
- [[agent-communication-interview|父子 Agent 和多 Agent 之间怎么通信？]]
- [[agent-conflict-interview|多 Agent 协作发生冲突时怎么处理？]]
- [[parent-agent-interview|父子 Agent 之间如何交互和传递上下文？]]
- [[a2a-interview|你对 A2A 协议了解多少？]]

## 工具选择、执行与安全

- [[agent-design-interview|怎样设计一个 Agent？]]
- [[react-interview|ReAct 的架构是什么？]]
- [[agent-intent-interview|Agent 为什么知道调用哪个工具？怎么做意图识别？]]
- [[tool-calling-interview|Agent 如何执行工具调用，并处理参数异常与工具失败？]]
- [[mcp-integration-interview|MCP 工具怎么接入？]]
- [[agent-sandbox-interview|Agent 里为什么要做沙箱？]]

## 任务进度与用户交互

- [[agent-stream-recovery-interview|页面刷新或断线后，怎样恢复 Agent 任务和流式输出？]]
- [[agent-progress-interview|Agent 任务运行较久时，前端怎样展示执行进度？]]
- [[agent-followup-interview|Agent 执行中怎样接收用户的新要求？]]

## 效果评测

- [[agent-evaluation-interview|怎么判断 Agent 的效果？]]

## 服务运行与排障

- [[agent-cancellation-interview|Agent 怎样响应用户取消并处理迟到结果？]]
- [[agent-approval-interview|Agent 怎样保存待审批操作并在批准后恢复执行？]]
- [[agent-checkpoint-interview|Agent 的 Checkpoint 应该保存什么，才能在中断后恢复？]]
- [[agent-checkpoint-failures-interview|Agent 在工具执行前后退出，怎样恢复并避免重复写入？]]
- [[agent-memory-leak-interview|Agent 服务最常见的生产环境内存泄漏有哪几种？如何排查和修复？]]
- [[agent-timeout-interview|模型调用响应慢，如何设计分层超时与熔断？高并发下怎么处理？]]
