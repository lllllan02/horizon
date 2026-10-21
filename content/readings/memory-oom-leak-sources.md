---
title: "内存耗尽与泄漏：官方资料导读"
category: "计算机基础"
tags: ["内存管理"]
learning_status: pending
created_at: "2026-10-19 15:28:59"
updated_at: "2026-10-20 21:02:14"
source:
  - "https://cwe.mitre.org/data/definitions/401.html"
  - "https://go.dev/doc/gc-guide#Tracing_garbage_collection"
  - "https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/#exceed-a-container-s-memory-limit"
  - "https://pkg.go.dev/net/http/pprof"
  - "https://pkg.go.dev/runtime/pprof#Profile"
  - "https://github.com/google/pprof/blob/main/doc/README.md"
---

**「内存泄漏描述有效使用结束后没有释放的缺陷，OOM 描述内存需求无法得到满足的结果。」** 本导读节选 MITRE CWE-401、Go GC 指南、Kubernetes 内存限制示例及 pprof 文档中与概念边界和定位有关的内容，核对于 2026-10-19。下方两组 pprof 数据是自拟教学示例，并非实际服务采样；不汇总完整 GC 算法或集群配置，未运行示例命令。

## 有效生命周期结束后未释放

[CWE-401 的定义](https://cwe.mitre.org/data/definitions/401.html)关注已分配内存在使用结束后未被充分跟踪和释放，导致无法重新分配与复用。原文的 C 示例在申请内存后读取失败，直接返回却没有释放已经申请的内存，展示了错误路径遗漏清理的原因。

文档还指出，异常中断和释放责任不明确容易引入此类问题。对手动管理内存的程序，丢失最后一个指针可能使程序再也找不到需要释放的内存；这一因果不能直接套到带追踪 GC 的对象上。

## GC 判断可达性

[Go GC 指南的 Tracing Garbage Collection](https://go.dev/doc/gc-guide#Tracing_garbage_collection)解释，GC 从根开始沿指针遍历对象图；能够在这个过程中找到的对象称为可达对象。标记完成后，未标记的堆对象才可被回收，供后续分配使用。

据此可以解释 Go 中的逻辑泄漏：业务已经不再使用的数据，如果仍被全局 map 等可达对象保留，GC 仍会将其视为存活。问题在于不必要的引用延长了对象寿命；暂时尚未完成回收不能单独证明泄漏。

## 内存上限与 OOM

[Kubernetes 的超出内存限制示例](https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/#exceed-a-container-s-memory-limit)给容器设置 100 MiB 上限，再尝试申请明显超过上限的内存。示例观察到容器被终止，终止原因是 `OOMKilled`，随后因重启策略反复启动与终止。

这个示例说明，允许使用的内存上限本身就是 OOM 的约束，不需要先出现内存泄漏。结合上述资料，区分「无用内存未释放」和「仍在使用的内存超过容量」，是对原因的归纳；不能仅凭内存曲线上涨就判定泄漏。

## 峰值占用示例

[runtime/pprof](https://pkg.go.dev/runtime/pprof#Profile)说明，`inuse_space` 关注仍存活的堆对象占用，报告依据最近完成的 GC。它按分配调用栈统计，不能直接展示对象当前被谁引用。[HTTP pprof](https://pkg.go.dev/net/http/pprof)支持通过 `heap?gc=1` 在采样前执行一次 GC。

假设服务已启用 pprof，并在本机 `127.0.0.1:6060` 提供端点。怀疑峰值占用过高时，在高峰仍持续的情况下采集：

```sh
curl -o heap-peak.pprof 'http://127.0.0.1:6060/debug/pprof/heap?gc=1'
go tool pprof -inuse_space ./server heap-peak.pprof
```

`./server` 是与运行服务对应的程序二进制。进入后，执行 `top` 看直接占用最多的函数，执行 `top -cum` 看包含下游调用的占用，执行 `list loadBatch` 查看对应源码行；查看源码需要本地有匹配的源码文件。

下面将一份假设报告简化为三列，数字表示仍存活对象的占用，而非累计分配量：

| 函数 | flat | cum |
| --- | ---: | ---: |
| `main.loadBatch` | 200 MB | 200 MB |
| `main.encodeResponse` | 20 MB | 20 MB |
| `main.handleRequest` | 0 MB | 220 MB |

[pprof 报告说明](https://github.com/google/pprof/blob/main/doc/README.md#details)中，`flat` 表示归到函数自身的采样值，`cum` 包含其下游调用。这里假设 `handleRequest` 调用了前两个函数，所以它的 220 MB 是汇总值，不能再与前两行相加。

主要调查对象是 `loadBatch`：通过 `list` 找到分配行后，结合代码和监控确认是单个批次读入过多数据，还是同时执行的批次太多。报告本身还不能区分这两个原因。修复方向分别可能是减小批次、流式读取或控制并发；若业务需求合理且无法进一步降低占用，再评估容量。

## 持续保留示例

怀疑泄漏时，先在相近负载下采集同一进程的基准快照，经过一段业务负载后再采集一份，均在 GC 后观察。以下命令在两个时间点分别执行，采集期间服务保持运行：

```sh
curl -o heap-before.pprof 'http://127.0.0.1:6060/debug/pprof/heap?gc=1'
# 经过一段业务负载后，再执行下面一行
curl -o heap-after.pprof 'http://127.0.0.1:6060/debug/pprof/heap?gc=1'
go tool pprof -inuse_space -base heap-before.pprof ./server heap-after.pprof
```

[pprof 的快照比较](https://github.com/google/pprof/blob/main/doc/README.md#comparing-profiles)支持从后一份中减去基准快照。进入后用 `top` 看净增长主要集中在哪里；表中前后值是假设的直接占用，差值对应后一份减去前一份：

| 分配函数 | 前一次 | 后一次 | 净增长 |
| --- | ---: | ---: | ---: |
| `main.newCacheValue` | 20 MB | 170 MB | +150 MB |
| `main.loadBatch` | 20 MB | 20 MB | 0 MB |

这里应先调查 `newCacheValue` 分配出来的数据去了哪里。例如发现它们被写入全局 map，就核对条目是否还有用途、是否设置容量上限及删除逻辑，并记录条目数验证是否与内存同步增长。**「增长定位到分配路径，泄漏判断还要核对对象是否已经无用」**；正常缓存预热或任务积压也会留下更多存活对象。

差值表示这段时间各分配路径对应存活内存的净变化，不表示期间总共分配了多少；采样数值用于定位主要方向，不能把示例中的整数当作精确测量。对于已被 OOM 终止的进程，需要依赖之前保存的快照或复现采集。

## 协程栈辅助定位

[runtime/pprof 的 Profile 文档](https://pkg.go.dev/runtime/pprof#Profile)将 `goroutine` profile 定义为所有当前 goroutine 的栈；[Profile.WriteTo](https://pkg.go.dev/runtime/pprof#Profile.WriteTo)说明，`debug=2` 会按未恢复 panic 的形式打印 goroutine 栈。[HTTP pprof](https://pkg.go.dev/net/http/pprof)通过 `/debug/pprof/goroutine?debug=2` 提供对应的文本输出。

基于这些信息，可以在多个时间点采集并对比栈，检查同一阻塞位置的协程是否不断增加，再回代码核对请求是否已经结束、取消是否被响应、任务是否还有退出路径。这是排查建议：**单次看到很多等待栈，只能说明当前状态；判断泄漏还需要确认任务本应退出。** 正常工作协程也可能长期等待任务，数量增加还可能来自正常负载或任务积压。

本节官方文档核对于 2026-10-20；未对实际服务采集 profile，也未执行泄漏复现或修复实验。
