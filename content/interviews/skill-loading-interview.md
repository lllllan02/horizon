---
title: "Skill 的懒加载是怎么实现的？"
aliases: ["Skill 懒加载", "Skill 渐进式披露"]
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "按需加载"]
type: practice
learning_status: organized
created_at: "2026-10-22 13:20:45"
updated_at: "2026-10-22 13:20:45"
learning_status_changed_at: "2026-10-22 13:23:03.723"
---

核心是[[agent-loading|分层加载]]，也叫渐进式披露。因为 Skill 的完整指令可能很长，全部放进上下文会占用很多 Token，所以一开始只提供轻量的技能目录。

实现时，运行时先扫描配置的 Skill 目录，提取 `SKILL.md` 中的 `name`、`description`，并保留对应的文件位置。`description` 要说明这个 Skill 做什么、什么时候使用，方便模型根据当前任务判断是否需要它。

模型选中 Skill 后，再发起工具调用，由运行时读取完整正文，把结果加入后续模型上下文，模型再按照其中的指令执行。用户明确指定 Skill 时，也可以直接触发加载。

如果正文还引用了[[anthropic-agent-skills-summary|参考资料或脚本]]，也等实际用到时再读取或执行。这样就形成了「元数据 → 完整指令 → 附属资源」的逐层加载过程，减少无关内容对上下文的占用。
