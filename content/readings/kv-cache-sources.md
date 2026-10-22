---
title: "KV Cache 与前缀缓存资料"
category: "LLM"
tags: ["LLM", "推理优化", "上下文管理"]
learning_status: pending
created_at: "2026-10-21 21:09:09"
updated_at: "2026-10-22 15:00:47"
source:
  - "https://huggingface.co/docs/transformers/main/cache_explanation"
  - "https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/"
  - "https://docs.vllm.ai/en/latest/design/prefix_caching/"
  - "https://docs.vllm.ai/en/latest/serving/data_parallel_deployment/"
  - "https://platform.claude.com/docs/en/build-with-claude/prompt-caching"
---

**KV Cache 在生成过程中复用历史 K、V；前缀缓存进一步把已有输入的计算复用于后续请求。** 两者应分层理解：前者解释缓存对象，后者解释 Agent 多轮请求的命中条件。本文节选相关官方文档：基础机制核对于 2026-10-21，缓存隔离与多实例路由补充核对于 2026-10-22；不覆盖完整推理优化体系，也未进行性能实测。

## 逐 Token 生成时缓存什么

[Hugging Face：How caching works](https://huggingface.co/docs/transformers/main/cache_explanation#attention-matrices)说明，自回归模型逐 Token 生成，每一步都依赖前文；若反复计算历史 K、V，会造成重复工作。因果注意力限制前面位置看到未来，因此历史位置的 K、V 可以保留并复用，各层分别维护缓存。

新位置仍计算自己的 Q、K、V，并用当前 Q 与历史及当前 K、V 做注意力计算，再追加新 K、V。因此，缓存省去的是历史部分的重复计算，注意力对历史的读取仍然存在。保存更多位置也会增加缓存占用。这里讨论常见因果注意力推理，不把其结构推广到所有模型架构。

## 跨请求复用省掉哪段计算

[vLLM：Automatic Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/)介绍，已有请求的 KV 可供新请求复用，前提是两者具有相同前缀。长文档加不同问题、多轮对话保留共同历史，是文档给出的典型场景。

文档的 [Limits](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/#limits) 明确：APC 直接减少输入预填充（Prefill）的处理时间，不直接减少生成新 Token 的解码（Decode）时间。如果请求没有公共前缀，或耗时主要来自长回答生成，收益会受限。该结论不等于「端到端延迟一定下降固定比例」。

[vLLM 的实现说明](https://docs.vllm.ai/en/latest/design/prefix_caching/)中，缓存块的标识还包含父前缀，且当前实现按完整块缓存并支持淘汰。因此，相同文本出现在不同前文之后，不能据此独立复用；相同前缀也可能因缓存被淘汰而未命中。这是匹配条件与缓存可用性两个不同问题。

## 接口怎样决定是否命中

[Anthropic：Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)要求匹配对应前缀，层级顺序为工具定义、系统消息、普通消息。静态内容应尽量靠前；使用显式缓存断点时，应在可复用内容末尾建立缓存条目。如果只在包含变化时间戳或新问题的位置设置断点，可能一直写入新条目，却无法读取之前的稳定部分。

缓存还受模型最低长度与有效期约束，首次调用可能只有写入，后续才读取。Claude 可通过 `cache_read_input_tokens` 与 `cache_creation_input_tokens` 区分读取和创建；总输入还应包含普通 `input_tokens`。这些字段和断点规则属于该接口，不能直接套到其他平台。接入时核对当前模型文档，不把某个固定长度或有效期当作通用要求。

[缓存存储与共享规则](https://platform.claude.com/docs/en/build-with-claude/prompt-caching#cache-storage-and-sharing)还说明，缓存存在组织或工作区等隔离边界，具体范围取决于接入平台。因此，即使前缀相同、供应商与模型一致，也要确认请求处于可共享缓存的范围，不能仅凭模型名判断命中。

## Agent 怎样保持可复用前缀

[[manus-context-engineering-summary#为什么优先考虑缓存？|Manus 的生产经验]]强调稳定提示前缀、确定性序列化与追加历史，并指出前置时间戳会破坏复用。工具定义频繁变化同样可能改变前缀；这支持尽量稳定同一任务的必要工具定义，但不意味着工具越多越好。

[[agent-token-cost-sources#降本从哪里入手|OpenAI 成本资料]]也区分了提示缓存和保留会话：有历史记录不保证命中，命中后仍需生成新回答。应用时，应一起比较缓存读取比例、首 Token 延迟和整任务费用，不能只追求命中比例。

保持历史稳定与[[anthropic-context-editing-summary|清理旧工具结果]]存在取舍：替换旧内容可能改变后续前缀，但能减少输入体积。比较时应计入缓存重建和继续携带无用上下文的成本；这是结合两类机制形成的应用建议。

[vLLM：Data Parallel Deployment](https://docs.vllm.ai/en/latest/serving/data_parallel_deployment/)明确，各数据并行引擎拥有独立的 KV Cache；结合缓存状态、运行中请求和等待队列分配请求，有助于提高前缀缓存收益。因此，自建多实例服务应让相同前缀请求尽量到达持有或可访问对应缓存的实例，并兼顾排队与负载。文档同时说明，当前内部负载均衡依据运行与等待队列，不能假定默认已经实现缓存感知路由。本文未进行路由或性能实测。
