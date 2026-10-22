---
title: "怎样提高 Agent 的 KV Cache 命中率？"
aliases: ["优化 KV Cache 命中效率", "Agent 前缀缓存优化"]
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "上下文管理", "成本优化"]
learning_status: organized
created_at: "2026-10-21 21:09:09"
updated_at: "2026-10-22 15:08:37"
learning_status_changed_at: "2026-10-22 15:09:31.567"
---

[[kv-cache|KV Cache]] 缓存已处理 Token 在注意力层中产生的键（Key）、值（Value）向量，供后续推理复用，减少重复计算。

服务支持**跨请求前缀缓存**时，可以分四层优化：

1. **同一任务**：固定系统提示词、工具定义和历史的拼接方式，历史尽量只追加。
2. **不同任务**：复用相同的系统提示词、工具定义等公共前缀，任务特有输入放在后面。
3. [[llm-gateway-request|模型路由]]：同一任务尽量保持供应商和实际模型一致，避免切换到缓存不共享的渠道。
4. **实例路由**：自建部署时，尽量路由到持有或能访问已有缓存的推理实例。

命中仍需**前缀精确匹配、缓存可用**，并满足[[kv-cache-sources#接口怎样决定是否命中|隔离范围、有效期等服务条件]]。
