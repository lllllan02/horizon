---
title: "Agent 在工具执行前后退出，怎样恢复并避免重复写入？"
aliases: ["Agent 中断恢复故障推演", "Checkpoint 失败窗口"]
parent: agent-interview-hub
category: "Agent"
tags: ["面试", "Agent", "Checkpoint", "幂等"]
type: practice
learning_status: organized
created_at: "2026-10-20T14:44:29+08:00"
updated_at: "2026-10-20T14:59:55+08:00"
learning_status_changed_at: "2026-10-20T15:06:45.904+08:00"
---

[[agent-checkpoint-recovery|Checkpoint]]要保存足以确定下一步的执行进度：当前处于模型调用还是工具执行阶段，哪些结果已经确认；执行工具时，还要定位到[[agent-checkpoint-runtime|哪一批原始请求、具体哪个调用]]，并关联[[tool-approvals|审批与权限检查]]等继续条件。原请求和结果可以另存在[[history-storage|会话历史]]中，Checkpoint 保存引用。**记录粒度以能够正确恢复为准**，结果和对应进度要一致提交，不需要给每一行代码都设置前后标记。

恢复时读取最近已提交的记录，选择对应执行入口，复用已保存结果，并核验当前继续条件。但**本地没有结果，不代表外部工具没有执行**：请求可能已经成功，只是返回或进度没能保存。应提前保留稳定的操作标识，恢复时先核查原结果；需要重试时，在[[aws-idempotent-retries-summary|服务端幂等约定]]与保留期内沿用原标识、原参数，避免重复业务效果。查不到不等于未执行，无法确认且不能安全重试时，暂停并人工核查。

例如[[langgraph-human-interrupts|LangGraph 的中断恢复]]会从中断节点开头重跑，因此节点内的外部写入也要考虑重复执行。Checkpoint 解决接续位置，幂等处理保障重试时的业务效果。

下图以先审批、再创建工单为例，K 标识同一次创建；属于自拟设计推演，未做故障注入实测。

![[assets/agent-checkpoint-failures.png|760]]
