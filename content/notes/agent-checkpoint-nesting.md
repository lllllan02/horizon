---
title: "嵌套 Agent 的 Checkpoint"
parent: agent-checkpoint-recovery
category: "Agent"
tags: ["Agent", "Checkpoint", "持久化", "多Agent协作"]
learning_status: organized
created_at: "2026-10-19 21:23:30"
updated_at: "2026-10-19 21:37:28"
reading_suggestions:
  - agent-checkpoint-runtime
learning_status_changed_at: "2026-10-19 21:48:08.027"
---

把[[multi-agent#调用与通信|子 Agent 包装成工具]]后，父层的工具下标只能定位到这个调用，无法表达子 Agent 内部执行到哪里。**需要将单份进度扩成父子调用链，每层保留自己的执行位置。**

以下沿用[[agent-checkpoint-runtime|单 Agent Loop 的字段]]，限定父层等待子层返回、各层工具串行执行。共同的持久化与恢复流程见[[agent-checkpoint-recovery|Checkpoint 总览]]。

## 记录内容

每层保留 `stage`、`next_tool` 和可选的 `state_ref`，并增加：

1. `child`：父层当前工具请求对应的子进度对象。内部仍有同样的字段，也可以继续包含 `child`。没有子调用时省略；子调用存在期间，父工具下标不变。子层已 `done` 但结果尚未回填时，也保留这个对象。
2. `agent_key`：本层 Agent 在程序注册表中的入口名称，用于选择执行定义，例如 `planner`、`researcher`。若调用方或父工具已唯一确定该入口，可以省略。

## 记录示例

父层停在第二个工具请求，子层正要执行自己的第一个工具。[[assets/agent-nested-checkpoint-example.json|实际保存的完整快照]]中，控制部分如下：

```json
{
  "agent_key": "planner",
  "stage": "tools",
  "next_tool": 1,
  "state_ref": "root",
  "child": {
    "agent_key": "researcher",
    "stage": "tools",
    "next_tool": 0,
    "state_ref": "root/root-research"
  }
}
```

`child` 属于父层的 `ToolCalls[1]`，子层的下标 `0` 则作用于子层自己的列表。各层请求列表及顺序保持不变。该 JSON 是教学设计，[[eino-checkpoints#AgentTool 怎样保留子 Agent 的进度？|Eino AgentTool]]实际通过工具中断状态携带子检查点。

## 如何定位下一步

1. **子调用未完成**：沿 `child` 向下找，恢复最深层的进度，不重新创建子 Agent。本例执行 researcher 的 `ToolCalls[0]`，父层继续停在下标 1。
2. **子调用已完成**：将其最终输出回填为父层当前工具请求的结果，使用原调用 ID；同次提交清除 `child` 与父进度推进。本批工具全部完成后，父层切回 `model`。
3. **没有子调用**：按本层字段执行；首次进入 Agent 工具时，先保存初始子进度和输入，再启动它。

![[assets/agent-nested-checkpoint.png|640]]

[[assets/agent-nested-checkpoint.go|Go 教学示例]]用标准库模拟模型与工具，每次启动推进一步，已验证三层调用的跨进程接续与逐层回填。运行命令及单写者、文件替换等存储边界写在代码开头。
