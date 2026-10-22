---
title: "怎样让 Agent 支持 Skill？"
aliases: ["Agent 的 Skill 接入", "Skill 系统设计"]
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "按需加载"]
type: practice
learning_status: organized
created_at: "2026-10-21 21:32:24"
updated_at: "2026-10-21 21:41:10"
learning_status_changed_at: "2026-10-21 21:51:35.737"
---

核心就是**按需加载**。我会配置 Skill 目录，扫描其中的 `SKILL.md`，提取 `name`、`description`，并保存名称到文件位置的映射。组装模型上下文时先提供这些元数据，再提供一个读取工具，让模型根据任务[[anthropic-agent-skills-summary|按需获取完整指令和相关资料]]，然后沿着已有的 [[agent-loop|Agent Loop]] 调用工具完成任务，沿用原来的[[tool-permissions|权限控制]]。

目录可以分成**全局目录和项目目录**，分别保存通用技能和项目专用技能，扫描后合并成当前可用列表。我会约定同名时优先使用项目版本，让项目能覆盖通用做法。
