---
title: "Agent 平台按任务动态拼装 Skill 时，哪些内容应固定，哪些可以调整？"
aliases: ["Skill 的固定内容与动态内容"]
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "上下文管理"]
type: practice
learning_status: organized
created_at: "2026-10-21 11:30:01"
updated_at: "2026-10-21 11:42:20"
learning_status_changed_at: "2026-10-21 11:43:36.498"
---

平台按任务[[agent-loading|组合已有 Skill]]时，我会分成两部分：

- **固定内容**：名称、职责、适用场景、基础指令，以及平台约定的输入输出契约和工具接口，保证组合后的能力有稳定边界。
- **动态内容**：每轮请求、调用参数、工具反馈，以及据此补充的[[agent-skills-sources#运行时怎样绑定动态内容|场景指令]]。例如，审查规范固定，待审查代码和重点检查位置随任务变化。

「固定」指同一版本内稳定；实际工具地址可按环境配置。**动态调整须遵守既定契约与权限。**
