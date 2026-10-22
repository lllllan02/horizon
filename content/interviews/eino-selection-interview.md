---
title: "为什么选择 Eino 框架？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "Go", "工程选型"]
learning_status: organized
created_at: "2026-10-21 21:20:44"
updated_at: "2026-10-21 21:20:44"
learning_status_changed_at: "2026-10-21 21:28:05.347"
---

我们主要考虑了团队技术栈、框架的接口设计，以及维护和实践背景。

首先，团队主要使用 Go，所以我们优先保持 Go 技术栈，避免为了开发 Agent 再引入一门语言，增加学习、开发和维护成本，然后在这个范围内寻找合适的框架。

我们也检索过 LangChainGo 这样的 Go 实现。它延续了 LangChain 的一些抽象和组织方式，相比之下，我更习惯 CloudWeGo Eino 的[[eino-selection-sources#接口与编排设计|接口与编排设计]]：通过接口定义组件，用 Option 配置行为，通过 Callback 接入日志和追踪；节点的输入输出类型也比较明确，连接时能检查类型是否匹配。这些设计更符合我们的 Go 开发习惯。

最后，Eino 由字节跳动团队开源，官方也介绍过它在内部业务中的[[eino-selection-sources#实践背景与边界|使用和迭代经历]]。这些实践背景增加了我们采用它的信心，具体版本在我们业务中的稳定性，仍需要通过测试和运行观察来验证。
