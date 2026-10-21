---
learning_status: organized
title: "MCP 接入流程"
parent: mcp
category: "Agent"
tags: ["MCP", "工具调用", "协议"]
created_at: "2026-10-09"
updated_at: "2026-10-19 13:41:49"
reading_suggestions:
  - mcp-capabilities
  - mcp-tool-calling-go
  - mcp-permissions
  - mcp-architecture-summary
learning_status_changed_at: "2026-10-19 13:51:55.147"
---

**MCP 接入是将服务端（Server）提供的工具，接入宿主应用（Host）的模型调用循环。** 外部服务按 MCP 暴露能力后，Host 可以统一发现和调用工具，减少为每个服务单独编写接入逻辑；模型仍通过[[tool-calling|工具调用]]提出需求。

Host 管理模型和上下文，内部的客户端（Client）负责与 Server 通信。**「定义交给模型，执行留在 Server，Host 连接两者。」**

![[assets/mcp-flow.png|640]]

## 连接服务，取得工具定义

Server 先注册工具定义与处理函数，Host 再配置连接：stdio 由 Client 启动本地子进程，Streamable HTTP 则连接独立运行的 Server 地址。需要凭据时，由应用完成[[mcp-permissions|接入授权]]。

接通后，Client 用 `tools/list` 取得工具名、描述和参数约束（`inputSchema`）。Host 筛选当前可用工具，将定义转换成模型接口支持的格式，并保存「模型工具名 → 目标 Client 与原工具名」的映射。多个 Server 可能有同名工具，映射保证后续请求能找到正确的执行方。

[[mcp-architecture-summary|版本与能力发现]]须匹配实际协议：`2026-07-28` 可先调用 `server/discover`，每个请求仍携带版本与能力元数据；`2025-11-25` 使用 `initialize` 和 `notifications/initialized` 握手。SDK 可能封装这些交互，不能混用两版流程。

## 将模型请求交给 Server

模型依据定义和上下文，返回工具名与参数。Host 校验参数、判断本次操作是否获准，再按映射找到 Client，发送 `tools/call`；Server 根据原工具名找到处理函数，检查业务权限并执行业务逻辑。

**「模型提出调用，不代表调用已经执行。」** Host 可以拒绝请求，Server 也可能因权限或业务条件拒绝操作。[[mcp-tools-summary|工具结果与错误]]需要保留成功、业务失败和协议错误的区别，避免把失败反馈解释为执行成功。

## 将结果放回模型上下文

Client 收到结果后，Host 将它关联到原模型调用，加入上下文并再次请求模型。MCP 的 JSON-RPC 请求 ID 与模型接口的调用 ID 属于两段交互，由 Host 负责衔接。

模型结合结果回答用户，也可以提出下一次调用；调用循环仍由 Host 驱动，连接与工具定义通常可以复用。[[mcp-tool-calling-go|Go 接入示例]]在普通工具调用程序中替换定义获取和执行入口，保留原有模型循环。[[mcp-capabilities|资源与提示模板]]由 Host 按需获取，用于补充上下文，采用各自的读取接口。

工具目录变化或重连后，应刷新定义及映射，防止继续使用已撤销或已变更的工具。**「刷新目录不能确认断线前的调用是否已执行。」** 对写操作先核对远端状态，再决定是否重试；旧调用无法继续时，将变化或不确定性反馈给循环。不再使用时关闭 Client、订阅及由其启动的本地进程。
