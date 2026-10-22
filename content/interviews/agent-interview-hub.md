---
title: "Agent 面试题"
category: "Agent"
parent: interview-hub
tags: ["面试", "Agent"]
type: overview
learning_status: organized
created_at: "2026-10-18 23:14:14"
updated_at: "2026-10-20 15:54:42"
learning_status_changed_at: "2026-10-21 10:04:00.041"
---

围绕 Agent 开发的求职动机、执行模式、工具选择、协作通信、用户交互、效果评测与服务运行问题整理面试题与回答。

## 求职动机

- [[agent-career-motivation|为什么想做 Agent 开发？]]

## 认知与架构

- [[agent-vs-workflow-interview|Agent 和普通大模型应用、工作流有什么区别？]]
- [[agent-selection-interview|什么时候应该用 Agent，什么时候不需要？]]
- [[agent-understanding-interview|你怎么理解 Agent 系统？]]
- [[agent-design-interview|怎样设计一个 Agent？]]
- [[react-interview|ReAct Agent 的原理是什么？]]
- [[react-vs-plan-execute-interview|ReAct Agent 和 Plan-and-Execute 分别适合什么场景？]]

## 工具选择、执行与安全

- [[agent-intent-interview|Agent 为什么知道调用哪个工具？怎么做意图识别？]]
- [[tool-design-interview|工具怎么设计？]]
- [[skill-dynamic-interview|Agent 平台按任务动态拼装 Skill 时，哪些内容应固定，哪些可以调整？]]
- [[tool-calling-interview|Agent 如何执行工具调用，并处理参数异常与工具失败？]]
- [[agent-output-format-interview|模型输出不符合格式要求，怎么约束？]]
- [[agent-hallucination-interview|Agent 出现幻觉怎么兜底？]]
- [[tool-result-interview|工具或检索结果过大，怎么喂给大模型？]]
- [[mcp-interview|MCP 是什么，解决了什么问题？]]
- [[mcp-integration-interview|MCP 工具怎么接入？]]
- [[agent-sandbox-interview|Agent 里为什么要做沙箱？]]

## 协作与通信

- [[agent-delegation-interview|什么任务值得拆给多个 Agent？]]
- [[multi-agent-learning|多 Agent 协作学习入口]]
- [[a2a-interview|你对 A2A 协议了解多少？]]

## 任务进度与用户交互

- [[agent-clarification-interview|用户描述模糊时，怎样优化 Agent 的处理？]]
- [[agent-progress-interview|Agent 任务运行较久时，前端怎样展示执行进度？]]
- [[agent-stream-recovery-interview|页面刷新或断线后，怎样恢复 Agent 任务和流式输出？]]
- [[agent-followup-interview|Agent 执行中怎样接收用户的新要求？]]
- [[agent-cancellation-interview|如何响应用户取消？]]

## 上下文与记忆

- [[agent-history-storage-interview|Agent 的历史消息存数据库还是 JSONL 文件？]]
- [[context-overflow-interview|对话上下文超出窗口怎么办？]]
- [[agent-memory-types-interview|Agent 的记忆有哪些类型，分别怎么实现？]]
- [[agent-memory-trigger-interview|Agent 什么时候启动记忆提取？]]
- [[agent-memory-content-interview|什么内容值得保存为长期记忆？]]

## 状态保存与中断恢复

- [[agent-checkpoint-interview|Agent 的 Checkpoint 怎么实现？]]
- [[agent-upgrade-interview|Agent 升级 Prompt 或工具时，旧任务怎么办？]]

## 效果评测

- [[agent-evaluation-interview|怎么判断 Agent 的效果？]]
- [[agent-success-rate-interview|Agent 的任务成功率怎么定义？]]
- [[agent-token-cost-interview|Agent 的 Token 成本怎么算，怎么降低？]]

## 服务运行与排障

- [[agent-trace-interview|Agent 的 Trace 怎么做，线上问题怎么定位？]]
- [[agent-loop-interview|怎样避免 Agent 死循环和无限调用工具？]]
- [[agent-memory-leak-interview|Agent 服务最常见的生产环境内存泄漏有哪几种？如何排查和修复？]]
- [[agent-timeout-interview|模型调用响应慢，如何设计分层超时与熔断？高并发下怎么处理？]]
