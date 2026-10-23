---
title: "面试题与知识笔记整理清单"
aliases: ["interviews 与 notes 对照清单"]
category: "知识库管理"
tags: ["知识库", "面试"]
type: practice
learning_status: reading
created_at: "2026-10-23 23:42:06"
updated_at: "2026-10-23 23:42:06"
learning_status_changed_at: "2026-10-23 23:45:50.572"
---

这份清单用于协调 `interviews` 的面试回答与 `notes` 的知识解释：吸收互补内容，澄清适用条件，并保留各自的阅读用途。面试回答侧重口述与追问，知识笔记侧重机制、原因和边界；已有 Reading 与术语解释继续复用。

基于 2026-10-23 的目录清点与相关正文对照：当时 interviews 为 149 篇、notes 为 94 篇。本轮未确认两目录存在同条件下结论相反的直接技术冲突；以下包含覆盖不足、条件衔接和版本表述问题，不代表所有技术事实已经重新核实。

每次选择一个编号推进，先重读相关文件，再确定本项深度；修改正文、维护必要链接并验收后勾选。勾选只表示该整理项完成，不表示用户已经掌握。候选专题先确定问题与范围，再判断更新已有文档还是新建，不预先批量建卡。

## 优先补充已有知识笔记

- [ ] **A01 长期记忆更新与漏检修复**：把[[agent-memory-update-interview|提取、召回、判断与写入流程]]及[[agent-memory-matching-interview|实体／属性召回、误合并防护和写后修复]]补入[[agent-memory#存储与更新|记忆笔记]]。保留“未命中不代表不存在、相似不等于重复、多路召回仍会漏”的条件。

- [ ] **A02 Loop 的重复调用防护**：用[[agent-loop-interview|共享预算、调用指纹和正常轮询例外]]补强[[agent-loop|最小 Loop]]的运行时边界。保留最小伪代码的教学范围，重试预算复用[[agent-retry|重试机制]]。

- [ ] **A03 取消传播与迟到结果**：将[[agent-cancellation-interview|通知退出、运行失效和条件提交]]接到[[agent-checkpoint-scheduling|调度控制]]。已有笔记已说明旧检查点不能覆盖新取消，需补的是下游取消传播，以及状态、执行版本与结果提交的原子校验。

- [ ] **A04 客户端重连与后台恢复的分工**：将[[agent-stream-recovery-interview|会话／运行标识、事件补读、去重和快照兜底]]与[[history-storage|历史存储]]、[[agent-checkpoint-recovery|执行恢复]]串联。明确恢复展示不等于重跑任务，Redis Streams 是方案实例，事件保留与持久化边界仍需说明。

- [ ] **A05 工具失败与输出校验分流**：把[[tool-calling-interview|参数完整性、格式、业务与权限校验]]和[[agent-output-format-interview|输出格式约束]]补到[[tool-calling|工具调用]]，重试策略引用[[agent-retry|已有机制]]。区分模型拒绝与可修正错误，避免无限重生成；Schema 合规不能替代业务校验。

- [ ] **A06 大结果的聚合、分页与回读**：把[[tool-result-interview|先聚合再分页、代表样本和双重输出上限]]补到[[tool-interface-design|接口设计]]，与[[context-loading|按需回读]]衔接。保留次数、时间范围、截断位置与原文入口，不能因接口相同就掩盖不同故障。

- [ ] **A07 epoll 触发语义的知识承接**：将[[epoll-trigger-interview|LT／ET 的读取示例]]及[[linux-io-sources#epoll 的触发方式|已有依据]]中的必要解释补到[[epoll|知识笔记]]，面试题保留口述版。当前已有跨目录引用，调整目的是让知识笔记自身解释更完整。

## 进一步补充与跨专题连接

- [ ] **B01 升级后的旧任务兼容**：在[[tool-registry|工具契约版本]]与[[agent-checkpoint-scheduling|恢复定义兼容]]已有原则上，吸收[[agent-upgrade-interview|Prompt 实际内容留存、双版本退役和排空升级策略]]。等待审批、以后还会恢复的旧任务也要纳入退役条件。

- [ ] **B02 整次任务的成本归集**：用[[agent-token-cost-interview|主／子 Agent、重试和工具费用核算]]串联[[agent-trace|执行追踪]]、[[agent-evaluation|效果评测]]与[[llm-gateway-governance|调用尝试计量]]。比较包含失败尝试的每成功任务成本，具体计费字段保留供应商条件，不重复计算费用类别。

- [ ] **B03 Skill 定义与运行数据**：将[[skill-design-interview|目录扫描与名称映射]]、[[skill-loading-interview|发现与加载]]、[[skill-dynamic-interview|同版本定义和每轮任务数据的分工]]补入[[agent-loading|按需加载]]。同名覆盖规则、统一输入输出契约等须注明平台约定，不推广成开放格式的必需规则。

- [ ] **B04 记忆提取的触发入口**：在[[agent-memory|记忆保存标准]]之外，吸收[[agent-memory-trigger-interview|规则触发与模型主动提取的分工]]。触发提取不等于批准保存，两个入口仍须经过内容判断、去重和校验。

- [ ] **B05 新消息的生效边界与历史存储选型**：分别用[[agent-followup-interview|中途追加要求]]补充[[agent-context-input|本轮输入]]的生效时点，用[[agent-history-storage-interview|单写入回放、查询与事务需求]]补充[[history-storage|存储选择]]。原文未说明待处理队列是否持久化，不能据此认定必然丢消息；JSONL 格式与数据库位置也不是完全互斥类型。

- [ ] **B06 消息身份、去重与可靠提交**：用[[data-sync-sources|数据同步中的身份与提交边界]]、[[mq-reliability-interview|去重记录和业务变更同事务]]补充[[multi-agent-message-passing|消息传递]]及[[agent-checkpoint-recovery|检查点恢复]]。区分业务对象 ID、消息 ID 与消费位置，本地事务不能自动覆盖外部副作用。

- [ ] **B07 取消、容量与资源回收**：用[[go-context-interview|取消通知与主动响应]]、[[go-pool-interview|固定 worker 和有界队列]]联系[[tool-scheduling|工具调度]]、[[sandbox-concurrency|容量控制]]。区分通知取消、实际退出和释放名额；队满拒绝与阻塞等待保留各自契约。

- [ ] **B08 Trace 后的进一步诊断**：给[[agent-trace|追踪排障]]补充[[db-connection-wait-interview|连接获取与持有时间诊断]]，给[[sandbox-resources|资源超限]]联系[[go-oom-interview|容量、积压与滞留的区分]]。数据库 Span 长不直接等于 SQL 慢，Go 堆分析也不能解释整个容器或远端环境的全部内存。

## 用知识笔记补强面试回答

- [ ] **C01 Checkpoint 的正确性边界**：给[[agent-checkpoint-interview|口述答案]]补入[[agent-checkpoint-recovery|结果与进度一致提交、外部结果未知先核查]]。保存阶段和下标不足以单独保证恢复正确。

- [ ] **C02 评测与成功率口径**：用[[agent-evaluation|任务、试次、无法评分和重复运行指标]]补充[[agent-evaluation-interview|评测回答]]与[[agent-success-rate-interview|成功率回答]]，明确任务集、预算、分母及无法判定的处理。

- [ ] **C03 MCP 重连与契约恢复**：用[[mcp-flow|目录刷新]]、[[tool-registry|重名与契约变化]]和[[mcp-http-client|连接恢复边界]]补充[[mcp-integration-interview|接入回答]]。连接恢复不等于可以直接重发结果未知的写操作，协议版本条件按既有依据复核。

- [ ] **C04 沙箱按执行入口验证**：把[[sandbox-execution|不同工具执行入口]]和[[sandbox-verification|允许／拒绝路径验证]]补进[[agent-sandbox-interview|沙箱回答]]。一条 Shell 命令受限不能证明文件工具、MCP 与远程执行都受相同边界约束。

- [ ] **C05 A2A 的等待、终态与重连**：用[[a2a|任务生命周期]]补充[[a2a-interview|口述回答]]：等待输入可接续，终态后的新工作另建任务；断线先按已知任务 ID 查询，消息 ID 不自动保证业务去重。

## 澄清条件与同步版本表述

- [ ] **D01 语义任务状态与运行控制状态**：在[[agent-task-state-update|状态更新]]与[[agent-cancellation-interview|程序取消控制]]之间明确范围。模型可判断目标、约束和进展的语义更新，取消、期限与执行版本由运行程序强制维护；两者不构成直接冲突。

- [ ] **D02 局部重试与事务整体重试**：用[[mysql-transaction-retry|事务重试条件]]限定[[agent-retry|只重做必要部分]]的含义：安全恢复单位由事务／接口契约决定，可能需要重跑读取、判断和修改。不能把“必要部分”理解为只重发最后一条 SQL。

- [ ] **D03 缓存稳定性与按需加载、压缩**：串联[[agent-kv-cache-interview|前缀复用]]、[[tool-loading|按需工具定义]]、[[context-compaction|摘要压缩]]与[[context-trimming|历史裁剪]]的取舍。先满足正确性、窗口与必要能力，再比较成本；当前面试题已限定变化位置后的复用，不能误报为“任意改动令全部缓存失效”。

- [ ] **D04 完整成功与降级交付**：对照[[learning-plan-agent-fallback|项目降级取舍]]与[[agent-evaluation|任务验收]]，明确完整成功、降级交付和失败的统计区别。是否满足不可放弃的业务约束，仍需真实项目验收规则核实，不改写已有经历事实。

- [ ] **D05 Redis 主动过期的版本精度**：把[[redis-expiration-interview|面试回答]]的“随机抽查”与[[redis-expiration-sources|官方概括及 Redis 8.0 分批增量扫描]]对齐。可概括为周期性分批检查并在时间预算内清理，具体策略随版本变化；这是面试题与其来源的表述精度问题。

## 后续知识专题候选

以下主题已有面试题、Reading 或术语，需先判断知识笔记要解释的问题；没有独立 Note 不等于知识库没有内容。

- [ ] **E01 RAG**：从[[retrieval-interview-index|现有题组]]组织流程、分块、有效性与权限、混合检索、融合和评测；复用词项评分与向量检索术语，先建立整体认识。
- [ ] **E02 Go 并发与资源生命周期**：从[[go-interview-hub|Go 题组]]收敛调度、同步、取消、并发限制、内存与泄漏诊断的理解路径，不按每道题复制定义。
- [ ] **E03 可靠提交与恢复**：串联[[mysql-transaction-retry|事务重试]]、[[mq-reliability-interview|消息可靠性]]、[[kafka-offset-interview|消费进度]]、[[data-sync-interview-index|数据同步]]和[[agent-checkpoint-recovery|Checkpoint]]，先讲清提交前后的失败窗口。
- [ ] **E04 索引、缓存与性能诊断**：结合[[mysql-interview-index|MySQL]]、[[redis-interview-index|Redis]]与[[performance-interview-index|性能排查]]，围绕访问模式、缓存失效、连接等待和瓶颈验证组织知识。
- [ ] **E05 模型生成基础**：用[[llm-sampling-interview|采样参数]]、[[temperature-zero-interview|零温度与输出差异]]及其 Reading 形成需要的解释，区分稳定性、可复现性与正确性。

## 保留用途与核实边界

ReAct、工具调用、Agent 与工作流、IO 多路复用等已有口述摘要和机制解释，合理重复可保留。多 Agent 面试入口已引用相关 notes，可按追问需要补强；不因缺少同名面试题就认定知识缺失。

岗位清单、个人项目、实际选型理由继续保留原用途。抽取通用机制时保留条件，不把准备目标当作已掌握能力、个人偏好当作框架优劣定论，或把演示与单次实验推广为生产效果。

这份清单的依据是当前正文及关联材料的覆盖核对，未逐项重审全部外部资料，未重新运行数据库、消息链路、SDK 或沙箱实验。推进具体条目时，新增或有争议的技术判断仍需核对原始依据；完成后直接更新该条及实际知识落点。
