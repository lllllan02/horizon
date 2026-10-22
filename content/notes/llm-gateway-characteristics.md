---
title: "大模型请求的特殊性"
category: "模型网关"
parent: llm-gateway
tags: ["模型网关", "协议", "Token"]
type: concept
learning_status: organized
created_at: "2026-10-21 20:14:49"
updated_at: "2026-10-22 11:03:53"
learning_status_changed_at: "2026-10-22 11:10:22.997"
---

在[[llm-gateway-request|模型调用链路]]中，网关需要面对三类约束：

- **响应持续生成**：采用 [[sse|SSE]]等流式协议时，模型边生成边返回；收到内容不等于完整完成，还需按模型协议确认结束。若[[llm-gateway-sources#流式转发与失败边界|中途断流]]，重新调用的结果不能直接接在旧输出后冒充原响应的继续。
- **用量事前不确定**：输入、输出 Token 数和在途时长因请求而异，输出长度通常事前不确定。因此，请求次数不能代表实际消耗，流量与用量需要[[llm-gateway-governance|分别治理]]。
- **模型能力不同**：工具调用、结构化输出和多模态支持因模型而异。协议适配只能转换表达，不能补出能力；选择上游时还需核对[[llm-gateway-sources#统一接入与请求处理|能力与兼容范围]]。

![[assets/llm-gateway-characteristics.png|640]]
