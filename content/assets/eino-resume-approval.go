// Eino v0.9.14 ADK 审批恢复接入片段，未独立运行。
// runner 已配置相同 Agent 与持久存储；ID 来自先前中断记录。
// 由审批处理器调用；approved 已通过业务身份、操作与版本校验。
// 调用方继续消费返回的迭代器并处理事件错误。
package checkpointdemo

import (
	"context"

	"github.com/cloudwego/eino/adk"
)

func ResumeApproval(ctx context.Context, runner *adk.Runner,
	taskID, interruptID string, approved bool,
) (*adk.AsyncIterator[*adk.AgentEvent], error) {
	return runner.ResumeWithParams(ctx, taskID, &adk.ResumeParams{
		Targets: map[string]any{interruptID: approved},
	})
}
