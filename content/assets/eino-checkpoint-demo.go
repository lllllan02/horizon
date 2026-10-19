// Eino v0.9.14 Graph Checkpoint 示例。无需模型、API Key 或外部服务。
// 在包含 github.com/cloudwego/eino v0.9.14 的 Go module 中运行：
//
//	go run eino-checkpoint-demo.go -dir ./checkpoint-demo
//
// 首次运行在 publish 节点前中断，写出框架真实的 checkpoint.bin；
// 再运行加 -resume，读取同一文件，从 publish 继续。
// checkpoint.json 仅对原始 JSON 字节缩进，不改字段；不是通用 JSON 格式。
// 业务是自拟的发布草稿示例；publish 只打印文本，不发布任何内容。
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
)

type DraftState struct {
	Goal    string
	Draft   string
	Checked bool
}

// CheckPointStore 只接收字节：文件、数据库等后端均由应用实现。
type fileStore struct{ dir string }

func (s fileStore) Get(_ context.Context, id string) ([]byte, bool, error) {
	b, err := os.ReadFile(filepath.Join(s.dir, id+".bin"))
	if errors.Is(err, os.ErrNotExist) {
		return nil, false, nil
	}
	return b, err == nil, err
}

func (s fileStore) Set(_ context.Context, id string, b []byte) error {
	if err := os.MkdirAll(s.dir, 0700); err != nil {
		return err
	}
	path := filepath.Join(s.dir, id+".bin")
	if err := os.WriteFile(path+".tmp", b, 0600); err != nil {
		return err
	}
	return os.Rename(path+".tmp", path)
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}

func main() {
	dir := flag.String("dir", "./checkpoint-demo", "示例检查点目录")
	resume := flag.Bool("resume", false, "在新进程中恢复")
	flag.Parse()
	const id = "checkpoint"
	ctx := context.Background()
	schema.RegisterName[*DraftState]("horizon_checkpoint_draft_v1")
	store := fileStore{dir: *dir}
	if !*resume {
		_, exists, err := store.Get(ctx, id)
		must(err)
		if exists {
			panic("检查点已存在，请加 -resume 或换一个 -dir")
		}
	}

	g := compose.NewGraph[string, string](compose.WithGenLocalState(
		func(context.Context) *DraftState { return &DraftState{} },
	))
	must(g.AddLambdaNode("draft", compose.InvokableLambda(
		func(_ context.Context, input string) (string, error) {
			fmt.Println("执行 draft")
			return "草稿：" + input, nil
		},
	), compose.WithStatePostHandler(
		func(_ context.Context, output string, state *DraftState) (string, error) {
			state.Goal, state.Draft, state.Checked = "生成并检查草稿后模拟发布", output, true
			return output, nil
		},
	)))
	must(g.AddLambdaNode("publish", compose.InvokableLambda(
		func(_ context.Context, input string) (string, error) {
			fmt.Println("执行 publish（仅模拟）")
			return "模拟发布：" + input, nil
		},
	)))
	must(g.AddEdge(compose.START, "draft"))
	must(g.AddEdge("draft", "publish"))
	must(g.AddEdge("publish", compose.END))
	r, err := g.Compile(ctx, compose.WithGraphName("draft_demo"),
		compose.WithCheckPointStore(store),
		compose.WithInterruptBeforeNodes([]string{"publish"}))
	must(err)

	if !*resume {
		_, err = r.Invoke(ctx, "解释 Checkpoint 保存什么", compose.WithCheckPointID(id))
		_, interrupted := compose.ExtractInterruptInfo(err)
		if !interrupted {
			panic(fmt.Sprintf("预期中断，实际错误：%v", err))
		}
		raw, exists, err := store.Get(ctx, id)
		must(err)
		if !exists {
			panic("中断后未找到检查点")
		}
		var value any
		must(json.Unmarshal(raw, &value))
		pretty, err := json.MarshalIndent(value, "", "  ")
		must(err)
		must(os.WriteFile(filepath.Join(*dir, "checkpoint.json"), append(pretty, '\n'), 0600))
		fmt.Println("已保存 checkpoint.bin 和便于阅读的 checkpoint.json")
		return
	}
	// 对此固定的静态断点示例，加载原记录后直接继续。
	// 动态审批中断需按 InterruptID 传入经过业务校验的恢复决定。
	output, err := r.Invoke(ctx, "", compose.WithCheckPointID(id))
	must(err)
	fmt.Println(output)
}
