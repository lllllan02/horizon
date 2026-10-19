// 嵌套 Agent Checkpoint 教学演示；仅使用 Go 标准库。
// 初始化：go run agent-nested-checkpoint.go -file /tmp/nested.json -init
// 每次启动只走一步：go run agent-nested-checkpoint.go -file /tmp/nested.json
// 模型与工具均为确定性 mock，不调用真实 API；JSON 不是模型消息协议。
// checkpoint 与外部上下文 states 为便于演示放在同一 bundle：写临时文件后 rename。
// 仅支持单写者、受控步骤边界；未实现断电持久性或外部副作用的恰好一次执行。
// 恢复时 agent_key 对应的注册定义、工具列表及参数解释必须保持兼容。
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

type Frame struct {
	AgentKey string `json:"agent_key"`
	Stage    string `json:"stage"`
	NextTool int    `json:"next_tool"`
	StateRef string `json:"state_ref"`
	Child    *Frame `json:"child,omitempty"`
}

type ToolCall struct {
	ID   string            `json:"id"`
	Name string            `json:"name"`
	Args map[string]string `json:"args"`
}

type State struct {
	Input     string            `json:"input"`
	ToolCalls []ToolCall        `json:"tool_calls"`
	Results   map[string]string `json:"results"`
	Output    string            `json:"output,omitempty"`
}

type Bundle struct {
	Checkpoint *Frame            `json:"checkpoint"`
	States     map[string]*State `json:"states"`
}

type Definition struct {
	Calls []ToolCall
	Label string
}

// key 选择执行定义，不是运行次数；state_ref 指向该层已经保存的上下文。
var registry = map[string]Definition{
	"planner": {Label: "计划完成", Calls: []ToolCall{
		{ID: "root-local", Name: "read_doc", Args: map[string]string{"document": "overview"}},
		{ID: "root-research", Name: "delegate", Args: map[string]string{"agent_key": "researcher", "task": "研究 A，并审查 B"}},
	}},
	"researcher": {Label: "研究完成", Calls: []ToolCall{
		{ID: "research-read", Name: "read_doc", Args: map[string]string{"document": "A"}},
		{ID: "research-audit", Name: "delegate", Args: map[string]string{"agent_key": "auditor", "task": "审查 B"}},
	}},
	"auditor": {Label: "审查完成", Calls: []ToolCall{
		{ID: "audit-read", Name: "read_doc", Args: map[string]string{"document": "B"}},
	}},
}

func initial() *Bundle {
	return &Bundle{
		Checkpoint: &Frame{AgentKey: "planner", Stage: "tools", NextTool: 1, StateRef: "root"},
		States: map[string]*State{"root": {
			Input: "整理资料", ToolCalls: registry["planner"].Calls,
			Results: map[string]string{"root-local": "文档 overview 的内容（先前已保存）"},
		}},
	}
}

// 成功保存某个工具结果后，推进本批游标；最后一项完成则进入模型阶段。
func advance(f *Frame, s *State) {
	f.NextTool++
	if f.NextTool == len(s.ToolCalls) {
		f.Stage, f.NextTool = "model", 0
	}
}

func step(f *Frame, states map[string]*State) (string, error) {
	def, ok := registry[f.AgentKey]
	if !ok {
		return "", fmt.Errorf("未注册 Agent：%s", f.AgentKey)
	}
	s := states[f.StateRef]
	if s == nil || s.Results == nil {
		return "", fmt.Errorf("上下文不存在或缺少 results：%s", f.StateRef)
	}
	if f.Child != nil && f.Stage != "tools" {
		return "", fmt.Errorf("活动子 Agent 的父节点必须停在 tools 阶段")
	}
	switch f.Stage {
	case "done":
		return f.AgentKey + " 已结束", nil
	case "model":
		if s.ToolCalls == nil {
			s.ToolCalls = def.Calls
			f.Stage, f.NextTool = "tools", 0
			return fmt.Sprintf("%s mock 模型返回 %d 个工具请求", f.AgentKey, len(s.ToolCalls)), nil
		}
		for _, call := range s.ToolCalls {
			if _, done := s.Results[call.ID]; !done {
				return "", fmt.Errorf("%s 仍有未保存的工具结果：%s", f.AgentKey, call.ID)
			}
		}
		s.Output = def.Label
		f.Stage = "done"
		return f.AgentKey + " mock 模型生成最终输出，保存为 done", nil
	case "tools":
		if f.NextTool < 0 || f.NextTool >= len(s.ToolCalls) {
			return "", fmt.Errorf("%s 工具下标越界：%d", f.AgentKey, f.NextTool)
		}
		call := s.ToolCalls[f.NextTool]
		if _, done := s.Results[call.ID]; done {
			return "", fmt.Errorf("游标指向已完成请求：%s", call.ID)
		}
		if f.Child != nil {
			if call.Name != "delegate" || call.Args["agent_key"] != f.Child.AgentKey {
				return "", fmt.Errorf("子 Agent 与父工具请求不匹配：%s", call.ID)
			}
			if f.Child.Stage != "done" {
				return step(f.Child, states)
			}
			childState := states[f.Child.StateRef]
			if childState == nil || childState.Output == "" {
				return "", fmt.Errorf("子 Agent 的输出不存在")
			}
			s.Results[call.ID] = childState.Output
			f.Child = nil
			advance(f, s)
			return fmt.Sprintf("%s 回填子输出到原请求 %s，清除 child 并推进", f.AgentKey, call.ID), nil
		}
		if call.Name == "delegate" {
			key := call.Args["agent_key"]
			if _, ok := registry[key]; !ok {
				return "", fmt.Errorf("未注册子 Agent：%s", key)
			}
			ref := f.StateRef + "/" + call.ID
			if states[ref] != nil {
				return "", fmt.Errorf("创建子上下文时地址已存在：%s", ref)
			}
			states[ref] = &State{Input: call.Args["task"], Results: map[string]string{}}
			f.Child = &Frame{AgentKey: key, Stage: "model", StateRef: ref}
			return fmt.Sprintf("%s 为 %s 创建并保存 child=%s；本步不调用子模型", f.AgentKey, call.ID, key), nil
		}
		if call.Name != "read_doc" {
			return "", fmt.Errorf("未知工具：%s", call.Name)
		}
		s.Results[call.ID] = "文档 " + call.Args["document"] + " 的内容"
		advance(f, s)
		return fmt.Sprintf("%s mock 执行 %s(%s)，保存到 %s", f.AgentKey, call.Name, call.Args["document"], call.ID), nil
	default:
		return "", fmt.Errorf("未知阶段：%s", f.Stage)
	}
}

// 临时文件必须与目标文件位于同一目录；rename 只提供本例的文件替换边界。
// 未执行 fsync、未加锁，不能据此承诺断电持久性或支持多个进程同时写。
func save(path string, b *Bundle) error {
	raw, err := json.MarshalIndent(b, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".nested-*.json")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err = tmp.Write(append(raw, '\n')); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

func run() error {
	path := flag.String("file", "/tmp/nested.json", "checkpoint bundle 文件")
	init := flag.Bool("init", false, "初始化，不覆盖已有文件")
	flag.Parse()
	var b *Bundle
	var message string
	if *init {
		if _, err := os.Lstat(*path); !os.IsNotExist(err) {
			return fmt.Errorf("初始化要求目标文件不存在：%s", *path)
		}
		b, message = initial(), "初始化：planner tools[1]；tools[0] 的结果先前已保存"
	} else {
		raw, err := os.ReadFile(*path)
		if err != nil {
			return err
		}
		if err := json.Unmarshal(raw, &b); err != nil {
			return err
		}
		if b == nil || b.Checkpoint == nil || b.States == nil {
			return fmt.Errorf("缺少 checkpoint 或 states")
		}
		if b.Checkpoint.Stage == "done" {
			fmt.Println("planner 已结束；不调用模型或工具，不修改文件")
			return nil
		}
		message, err = step(b.Checkpoint, b.States)
		if err != nil {
			return err
		}
	}
	if err := save(*path, b); err != nil {
		return err
	}
	fmt.Println(message)
	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
