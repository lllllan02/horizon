---
title: "MCP 工具怎么接入？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "MCP", "工具调用"]
learning_status: organized
created_at: "2026-10-19 13:33:28"
updated_at: "2026-10-19 13:33:28"
learning_status_changed_at: "2026-10-19 13:37:52.108"
---

接入 [[mcp-flow|MCP 工具]]，首先得有相应的 MCP Server。它可以是本地启动的进程，也可以是已经部署好的远程服务。

在我们的程序里，可以用两种方式管理要连接的 Server：

- **「提前配置」**：在代码或配置里写好要连接哪些 MCP Server。本地服务配置启动命令，远程服务配置访问地址，需要授权的再配置相应信息。
- **「动态注册」**：程序启动后，再添加 MCP Server 的连接信息，比如启动命令或服务地址、授权方式等，由程序创建对应的 MCP Client 去连接。

连接并完成必要的协议准备后，我们通过 Client 调用 `tools/list`，获取这个 Server 提供的工具名称、描述和参数要求。如果有自己的[[tool-registry|工具注册中心]]，就把这些工具登记进去，同时保存工具名与对应 Client、Server 原工具名的映射。再把工具描述整理成模型需要的工具格式，提供给模型选择。

模型决定使用某个工具后，会返回工具名和参数。我们根据之前保存的映射，找到对应的 MCP Client 和 Server 原工具名，检查参数与权限，再通过 Client 向 Server 发起 `tools/call`。**「拿到执行结果后，再把结果返回给模型」**，让模型继续回答，或者决定下一步还需要调用什么工具。
