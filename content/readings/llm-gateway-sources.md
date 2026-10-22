---
title: "大模型网关：官方架构与实现导读"
category: "模型网关"
tags: ["模型网关", "服务治理", "协议"]
learning_status: pending
created_at: "2026-10-21 20:14:49"
updated_at: "2026-10-21 20:14:49"
source:
  - "https://apisix.apache.org/docs/apisix/architecture-design/apisix/"
  - "https://docs.vllm.ai/en/latest/design/arch_overview/"
  - "https://github.com/QuantumNous/new-api"
  - "https://github.com/QuantumNous/new-api/blob/main/relaykit/README.md"
  - "https://docs.litellm.ai/docs/simple_proxy"
  - "https://apisix.apache.org/docs/apisix/plugins/ai-proxy-multi/"
  - "https://apisix.apache.org/docs/apisix/plugins/ai-rate-limiting/"
  - "https://apisix.apache.org/docs/apisix/plugins/ai-cache/"
  - "https://nginx.org/en/docs/http/ngx_http_proxy_module.html"
  - "https://pkg.go.dev/net/http/httputil#ReverseProxy"
---

**这些资料展示了模型网关的职责、请求执行与协议适配边界；产品提供统一入口，并不代表上游能力和所有失败行为已经统一。** 本文只节选学习通用网关概念所需的部分，不是各项目的完整手册。

核对于 2026-10-21：APISIX 页面标注 3.19.0；New API 为当日可读的 `main`，未固定统一提交；其余为当前在线文档。源码入口与发布包可能不同，实施时须重新固定版本。本轮未部署项目、压测或验证账务一致性。

## 职责与配置边界

[APISIX 架构](https://apisix.apache.org/docs/apisix/architecture-design/apisix/)区分核心请求处理与插件扩展，并介绍配置和部署模式：核心负责路由匹配、负载均衡等处理，插件在配置的作用域内影响请求。规则配置与规则执行因此可以分别理解；traditional、decoupled、standalone 等模式也说明，职责区分不要求始终独立部署，更不意味着所有网关都必须使用 etcd。

[vLLM V1 进程架构](https://docs.vllm.ai/en/latest/design/arch_overview/#v1-process-architecture)把 HTTP 与流式输出放在 API Server，推理调度放在 Engine Core，模型执行放在 GPU Worker。它帮助定位推理服务内部职责；「网关访问模型，推理引擎执行计算」是结合这些资料的教学归纳，现实产品可以组合多层能力。

## 统一接入与请求处理

[New API 总览](https://github.com/QuantumNous/new-api)把统一模型访问、渠道、权限、路由、额度和日志组织在同一系统中。[请求路由](https://github.com/QuantumNous/new-api/blob/main/router/relay-router.go)中的文本生成入口经过令牌校验、速率限制与渠道分发，再进入 [Relay](https://github.com/QuantumNous/new-api/blob/main/controller/relay.go) 的计费准备、调用尝试和错误处理。这提供了追踪真实请求的起点，不足以证明全部失败组合都能正确退款。

[RelayKit 说明](https://github.com/QuantumNous/new-api/blob/main/relaykit/README.md)将协议转换与宿主的 HTTP/SSE 收发、鉴权、选渠道和计费分开。流式转换需保留工具调用、用量与结束状态等跨事件信息；不同协议的支持质量存在差别，协议专有字段也不保证无损转换。因此，统一格式还需说明具体能力与兼容范围。

[APISIX ai-proxy-multi](https://apisix.apache.org/docs/apisix/plugins/ai-proxy-multi/)从插件角度组合供应商适配、负载均衡、重试、降级与健康检查，并提供模型、Token 和首响应时间等记录。它与 New API 的功能有重叠，但组织方式不同，不能把一个项目的渠道和扣费语义直接套到另一个项目。

## Token 限流与缓存

[ai-rate-limiting](https://apisix.apache.org/docs/apisix/plugins/ai-rate-limiting/)按时间窗口和模型 Token 用量限制访问，可选择输入、输出或总用量。按响应后的实际用量扣减时，本次调用可能已经越过剩余额度，再限制后续调用；这与请求前严格预留的保证不同。

[ai-cache](https://apisix.apache.org/docs/apisix/plugins/ai-cache/)当前区分精确缓存和语义缓存，配合 AI 代理插件使用；语义层依赖 Redis Stack。匹配、隔离与完整流判定需要按配置核对，不能仅因装了缓存插件就推断租户隔离已满足。这里的插件行为仅用于比较机制，不代表所有网关的统一策略。

## 流式转发与失败边界

[NGINX proxy 模块](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_next_upstream)说明：只有尚未向客户端发送内容时，才可能改向其他上游；响应传输中途出错不能靠该机制透明修复。其 `proxy_read_timeout` 约束相邻两次读取之间的等待，不是整个请求总时限。

[Go ReverseProxy](https://pkg.go.dev/net/http/httputil#ReverseProxy)提供请求改写、Transport、响应修改和错误处理等入口；识别为流式响应或内容长度未知时会立即刷新写入。刷新解决转发时机，完整事件的含义仍由[[websocket-sse-standards#SSE|SSE 事件格式]]及上层模型协议决定。

## 项目与代码入口

[LiteLLM 网关总览](https://docs.litellm.ai/docs/simple_proxy)将兼容入口、虚拟密钥、模型权限、预算、用量费用、路由与可靠性能力集中展示，适合认识功能之间的关系；本轮未完整追踪内部源码。

New API 可从上述文本生成路由进入，再看 [适配接口](https://github.com/QuantumNous/new-api/blob/main/relay/channel/adapter.go)中的请求转换、发送与响应处理；APISIX 可从 [ai-proxy-multi 插件入口](https://github.com/apache/apisix/blob/master/apisix/plugins/ai-proxy-multi.lua)追踪插件与代理基础模块。后者链接为可变 `master`，不能视为与 3.19.0 发布包逐行一致。

把这些项目用作对照，并按「概念 → 小实验 → 源码」推进，是学习建议；资料未给出这一统一学习顺序，也未提供可直接比较的项目性能结论。
