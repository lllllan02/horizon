---
title: "怎样避免 Agent 死循环和无限调用工具？"
aliases: ["Agent 循环终止与工具重复调用"]
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "工具调用"]
type: practice
learning_status: organized
created_at: "2026-10-21 12:55:19"
updated_at: "2026-10-21 13:14:05"
learning_status_changed_at: "2026-10-21 13:25:32.641"
---

我会在程序里设置两层限制，再加一个人工兜底：

1. **设置全局上限**：限制总超时和最大 [[agent-loop|Agent Loop]] 轮数，比如 30 分钟或 100 轮，先到先停，具体阈值按任务调整。工具调用量、Token 和费用也要有预算，子 Agent 和[[agent-retry|重试]]共享剩余额度。
2. **限制重复调用**：用「工具名＋规范化参数」生成调用指纹，重复达到上限就拦截；正常轮询单独设置间隔和上限。
3. **提供人工中断入口**：界面提供停止按钮，让用户发现异常时能及时[[agent-cancellation-interview|取消任务]]；后端响应取消，停止派发新调用，并通知正在执行的任务退出。
