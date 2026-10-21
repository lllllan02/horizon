---
title: "Agent Skills：开放格式、动态内容与迭代"
category: "Agent"
tags: ["Agent", "按需加载", "上下文管理"]
learning_status: pending
created_at: "2026-10-21 11:30:01"
updated_at: "2026-10-21 11:30:01"
source:
  - "https://agentskills.io/specification"
  - "https://code.claude.com/docs/en/skills"
  - "https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills"
---

**开放格式定义 Skill 的组织方式，具体产品可以补充运行时参数和动态上下文能力；Skill 定义本身也可以通过观察与评估持续改进。** 本文节选三份官方资料中与这三个边界有关的内容，核对于 2026-10-21，未运行示例。资料没有规定一份通用的「固定字段／动态字段」清单。

## 开放格式规定了什么

[Agent Skills 规范](https://agentskills.io/specification#skillmd-format)要求 Skill 目录至少有 `SKILL.md`，文件由 YAML 元数据和 Markdown 指令组成，必需字段为 `name` 与 `description`。后者描述能力和使用时机，帮助 Agent 判断是否适用。

规范允许附带脚本、参考资料与资源，正文建议写操作步骤、输入输出示例和常见边界情况，但没有强制的正文结构，也没有统一的输入输出 Schema 或工具地址字段。`allowed-tools` 是可选的实验字段，支持程度依实现而异。因而，平台可以额外定义契约，但不能把自身约定当成所有 Skill 的必需格式。

规范的渐进式披露将入口元数据、完整指令与附属资源分层加载；[[anthropic-agent-skills-summary|Anthropic 的分层加载示例]]保留了 PDF 表单指令与脚本的具体组织方式。

## 运行时怎样绑定动态内容

Claude Code 的 [Available string substitutions](https://code.claude.com/docs/en/skills#available-string-substitutions)支持用 `$ARGUMENTS`、位置参数和会话信息替换 Skill 中的占位内容。例如，同一份修复问题的步骤可以接收不同的问题编号。

[Inject dynamic context](https://code.claude.com/docs/en/skills#inject-dynamic-context)展示另一种方式：发送 Skill 内容前执行命令，把命令结果注入提示词。官方 PR 摘要示例取得当前 diff、评论和变更文件，模型据此执行同一套总结要求。变化的是本次任务的数据，模板可以保持不变。

这些是 **Claude Code 的扩展能力**，不代表开放格式的所有实现都支持；动态命令执行还受权限、配置及 Skill 来源限制，不能把注入方式理解为自动获得执行授权。

## 观察反馈怎样用于迭代

Anthropic 原文的 [Developing and evaluating skills](https://www.anthropic.com/research/equipping-agents-for-the-real-world-with-agent-skills)一节建议先用代表性任务找出能力缺口，再逐步编写 Skill。观察实际执行时，要关注异常路径和对某些上下文的过度依赖，并特别检查影响触发的 `name` 与 `description`。

作者也建议把成功方法和常见错误整理为可复用的上下文或代码，按需要拆分指令文件。这意味着 **元数据和基础指令也可以迭代**，不能从分层加载推导出它们永久不变。将定义按版本管理、把每轮参数与长期修改分开，是据此形成的工程建议，并非开放格式规定的版本发布协议。
