---
title: "多 Agent 协作发生冲突时怎么处理？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "多Agent协作"]
learning_status: organized
created_at: "2026-10-20 16:52:24"
updated_at: "2026-10-20 16:59:53"
learning_status_changed_at: "2026-10-20 17:00:01.807"
---

我会先看[[multi-agent#协作组织|协作模式]]有没有明确的主管，再讨论冲突由谁处理。成员之间可以直接沟通，也可能仍有主管统筹；没有固定主管时，我会优先通过任务划分减少协调需求，再约定必要的冲突处理规则。

## 有主管

在有主管的模式下，我会尽量由[[claude-code-agent-collaboration#何时改用团队？|主管统一协调各个子 Agent]]。子 Agent 把中间结果、产物和必要依据向上传递，由主管结合整体任务汇总和判断。

如果两个子 Agent 的产物产生冲突，就由主管根据需求、约束和证据，判断哪些内容保留、哪些可以合并、哪些需要修改或重做，再把具体要求下发给对应的子 Agent。子 Agent 按要求调整后重新提交，由主管核对冲突是否解决、产物能否配合使用。

## 没有固定主管

我会尽量安排[[agent-delegation-interview|边界清楚、产物独立的任务]]，让各个 Agent 并行处理，减少产生冲突的可能。

如果仍出现冲突，比如修改同一份文件，或者得出不同结论，先让相关 Agent 根据任务要求和依据自行协调；在限定步骤内仍无法解决，就引入第三个 Agent 协调判断，或由人工介入。
