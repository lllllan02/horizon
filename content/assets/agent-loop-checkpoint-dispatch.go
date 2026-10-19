// 可运行的恢复入口教学示例，使用 Go 标准库。
// 运行：go run agent-loop-checkpoint-dispatch.go agent-loop-checkpoint-example.json
// main 读取外置教学快照，将 checkpoint 交给 ResolveNext，打印应执行的动作。
// 本例只验证字段如何选择入口和工具，不实际调用模型、工具或实现持久化事务。
// JSON 的 messages 是便于阅读的文本示意，非任何模型 API 的消息协议。
package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type Checkpoint struct {
	Stage    string `json:"stage"`
	NextTool int    `json:"next_tool,omitempty"`
	StateRef string `json:"state_ref"`
}

type ToolCall struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type State struct {
	Messages  []string   `json:"messages"`
	ToolCalls []ToolCall `json:"tool_calls"`
}

type Action struct {
	Kind     string
	Messages []string
	Call     *ToolCall
}

// states 代表已按固定版本读取的外部状态，真实系统可从数据库或文件加载。
// 调用者根据返回动作接入模型或工具执行器；执行完成后的保存规则由正文说明。
func ResolveNext(cp Checkpoint, states map[string]State) (Action, error) {
	if cp.Stage == "done" {
		return Action{Kind: "stop"}, nil
	}
	state, ok := states[cp.StateRef]
	if !ok {
		return Action{}, fmt.Errorf("恢复数据不存在：%s", cp.StateRef)
	}
	switch cp.Stage {
	case "model":
		return Action{Kind: "call_model", Messages: state.Messages}, nil
	case "tools":
		if cp.NextTool < 0 || cp.NextTool >= len(state.ToolCalls) {
			return Action{}, fmt.Errorf("工具游标越界：%d", cp.NextTool)
		}
		call := state.ToolCalls[cp.NextTool]
		return Action{Kind: "execute_tool", Call: &call}, nil
	default:
		return Action{}, fmt.Errorf("未知阶段：%s", cp.Stage)
	}
}

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "用法：go run agent-loop-checkpoint-dispatch.go agent-loop-checkpoint-example.json")
		os.Exit(1)
	}
	raw, err := os.ReadFile(os.Args[1])
	if err != nil {
		panic(err)
	}
	var examples struct {
		States    map[string]State `json:"states"`
		Snapshots []struct {
			Situation  string     `json:"situation"`
			Checkpoint Checkpoint `json:"checkpoint"`
		} `json:"snapshots"`
	}
	if err := json.Unmarshal(raw, &examples); err != nil {
		panic(err)
	}
	for _, example := range examples.Snapshots {
		action, err := ResolveNext(example.Checkpoint, examples.States)
		if err != nil {
			panic(err)
		}
		if action.Call != nil {
			fmt.Printf("%s → tools[%d]：%s %s\n", example.Situation,
				example.Checkpoint.NextTool, action.Call.Name, action.Call.Arguments)
		} else {
			fmt.Printf("%s → %s（%d 条输入消息）\n", example.Situation,
				action.Kind, len(action.Messages))
		}
	}
}
