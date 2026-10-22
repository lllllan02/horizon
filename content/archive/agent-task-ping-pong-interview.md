---
title: "多 Agent 之间相互推诿任务怎么办？"
category: "Agent"
parent: agent-interview-hub
tags: ["面试", "Agent", "多Agent协作"]
learning_status: organized
created_at: "2026-10-21 12:55:38"
updated_at: "2026-10-21 13:15:42"
learning_status_changed_at: "2026-10-21 13:26:23.707"
---

这类问题要先从**协作设计**说起。采用多 Agent 之前，要规划好[[agent-delegation-interview|哪些任务值得拆、拆分后有什么收益]]，划清任务边界，同时考虑启动、沟通、协调和汇总的成本。

设计时，我会优先考虑[[multi-agent-organization|由一个主管统筹]]，这样遇到分工或结果冲突时，就有明确的协调者。

- **有主管**：子 Agent 的产物、中间结果和任务状态都上交给主管。发生冲突，就由主管统一协调，判断哪些需要重做、哪些需要调整分工，再下发具体要求，避免子 Agent 之间反复转交、相互推诿。

- **没有主管**：两个 Agent 之间可能一直相互推诿。可以允许它们先自行沟通协调，但要设定[[autogen-group-chat#工程使用的边界|协调次数上限]]；超过上限仍无法解决，就停止相互转交，引入有权协调、改派的第三个 Agent，或者由人工介入。
