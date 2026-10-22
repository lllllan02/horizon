---
title: "零温度与推理可复现性：官方文档和源码导读"
category: "大模型"
tags: ["大模型"]
learning_status: pending
created_at: "2026-10-22 13:19:52"
updated_at: "2026-10-22 13:19:52"
source:
  - "https://github.com/vllm-project/vllm/blob/v0.11.0/vllm/sampling_params.py"
  - "https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/generation/logits_process.py"
  - "https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/generation/utils.py"
  - "https://docs.pytorch.org/docs/2.14/notes/numerical_accuracy.html"
  - "https://docs.vllm.ai/en/latest/usage/reproducibility/"
---

**贪心选择是否确定，与推理分数能否重复算得一致，是两个需要分别满足的条件。** 本篇节选 Transformers v4.57.1、vLLM v0.11.0 的解码源码、PyTorch 2.14 数值精度说明，以及核对日的 vLLM 在线可复现性文档；于 2026-10-22 核对，未运行模型实验，也未定位某个线上服务的实际差异原因。

## 零温度与贪心解码

[vLLM 的 SamplingParams.sampling_type](https://github.com/vllm-project/vllm/blob/v0.11.0/vllm/sampling_params.py) 先判断温度是否小于内部阈值，满足时返回 GREEDY，再进入有 seed 或无 seed 的随机分支。因此该版本的温度 0 表示贪心解码，不能解释成仍按低概率抽到了其他候选。

[Transformers 的 TemperatureLogitsWarper](https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/generation/logits_process.py) 通过 `scores / temperature` 缩放分数，只接受严格正值；传入 `0.0` 会报错并提示用 `do_sample=False` 实现贪心解码。零温度的接口约定需要查具体实现，不能直接把 0 代入除法。一般温度与候选截断的区别见[[llm-sampling-sources|采样参数导读]]。

[同版 _sample 的 token selection](https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/generation/utils.py) 中，启用采样时先 softmax，再调用 multinomial；关闭采样时调用 argmax 选最高分。新 token 随后拼入输入序列，参与下一步生成。

据此可推演：每步待选择分数相同、并列处理规则固定时，贪心选择一致；若某一步最高分候选改变，输入前缀随之改变，后续生成可能分叉。这是对代码路径的推演，微小数值差异不一定改变最高分候选。

## 分数为什么可能略有不同

[PyTorch 数值精度说明](https://docs.pytorch.org/docs/2.14/notes/numerical_accuracy.html)指出，浮点运算精度有限，加法和乘法不满足结合律，运算次序会影响结果。数学上相同的计算不保证逐位一致，不同框架版本、平台及 CPU/GPU 之间也没有这种保证。

同页的 Batched computations or slice computations 进一步说明，批次计算与逐项计算可能采用不同实现，结果略有差别。例如批量矩阵乘法中取出的一个结果，不保证与单独对该项做矩阵乘法逐位相同。这支持了「请求的批次或计算路径变化可能引入数值差异」，不能扩大成「GPU 并行必然让每次输出不同」。

结合贪心规则可推导：只有差异足以改变候选排序时，才会在选词上体现；候选分数越接近，越需要留意这种可能性。

## 固定 seed 还缺什么

[vLLM 可复现性文档](https://docs.vllm.ai/en/latest/usage/reproducibility/)说明，为了性能，默认不保证结果可复现。离线模式可采用确定性调度，或启用 batch invariance 使输出不受调度影响；在线模式采用 batch invariance。文档同时限定，即使使用这些配置，也要求相同硬件和相同 vLLM 版本。这里记录的是核对日的在线文档行为，不回推为 v0.11.0 已提供这些配置。

同页将 seed 定义为控制随机数生成器状态的参数。因此，固定 seed 不能替代对调度、计算路径及环境的控制；纯贪心分支的选词也不依赖随机抽样。

用于应用排查时，建议先确认完整请求、历史消息和模型版本一致，再核对框架的确定性能力。它们是由上述条件形成的排查建议，不能据此认定任一具体服务使用了什么后端或发生了什么变化。
