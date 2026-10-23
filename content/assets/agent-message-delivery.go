// 自拟教学示例：展示同进程 Channel 投递，不包含真实模型或 Agent 运行循环。
package example

import "context"

type Message struct {
	ID, TaskID, From, To string
	Kind, Body           string
}

// 调用方创建各成员的收件箱，如 make(chan Message, 8)，并负责目标校验与路由。
// ctx 应由调用方设置超时，并在不再需要时取消。
// 返回 nil 只表示通道交付；确认处理、重试去重与进程退出后的恢复需另行实现。
func deliver(ctx context.Context, inbox chan<- Message, msg Message) error {
	select {
	case inbox <- msg:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// 接收方运行循环确认有消息后，通过 msg := <-inbox 取出消息，核对 TaskID，
// 再把发送者、类型、正文加入下一次模型输入。Channel 本身不修改模型历史。
// select 多个分支都就绪时，不保证优先选择取消分支。
