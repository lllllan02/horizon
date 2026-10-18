---
title: "gRPC：截止时间传播与超时后的工作停止"
category: "分布式系统"
tags: ["超时", "取消"]
learning_status: pending
created_at: "2026-10-18T23:47:18+08:00"
updated_at: "2026-10-18T23:47:18+08:00"
source: "https://grpc.io/docs/guides/deadlines/"
---

gRPC 的 [Deadlines 指南](https://grpc.io/docs/guides/deadlines/)用[[timeout-and-deadline|截止时间]]约束调用方等待，并要求服务端应用在请求失效后停止派生工作。期限传播与取消配合，才能减少无效资源占用。

## 时长与时间点

Timeout 表示最多等待的时长，Deadline 表示最晚完成的时间点；调用开始时，用当前时间加上超时时长可以得到截止时间。客户端超过期限仍未收到结果，会以 `DEADLINE_EXCEEDED` 结束 RPC。指南提醒显式设置合理期限，并用负载测试校准，不能把一个固定值当作通用答案。[客户端期限](https://grpc.io/docs/guides/deadlines/#deadlines-on-the-client)

## 期限怎样沿调用链传递

服务端继续调用其他服务时，需要保留原请求的期限。gRPC 传递的是扣除已消耗时间后的剩余时长，避免直接传递绝对时间造成跨机器时钟偏差。自动传播的支持与启用方式依语言而异，不能在下游重新给予完整预算。[Deadline Propagation](https://grpc.io/docs/guides/deadlines/#deadline-propagation)

## RPC 取消之后谁停止工作

期限到达后，gRPC 服务端会取消对应调用，但应用派生的长任务仍须检查取消状态并自行停止。框架结束 RPC 不等于所有计算、线程或外部操作已被终止。[服务端期限](https://grpc.io/docs/guides/deadlines/#deadlines-on-the-server)

本导读覆盖指南中的期限语义、传播与取消责任，按 2026-10-18 在线文档整理；未运行语言示例。
