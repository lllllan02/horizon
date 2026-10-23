// 自拟教学示例：同进程中共享同一个 StateStore，保护任务文件的读、改、写。
// 未接真实模型；Mutex 不协调其他进程，WriteFile 不提供崩溃恢复或事务保证。
package example

import (
	"encoding/json"
	"os"
	"sync"
)

type TaskState struct {
	TaskID   string            `json:"task_id"`
	Evidence map[string]string `json:"evidence"`
}

// 同一文件的所有工具必须共用这一实例，不得为每个成员各建一把锁。
type StateStore struct {
	mu     sync.Mutex
	path   string
	taskID string
}

func NewStateStore(path, taskID string) *StateStore {
	return &StateStore{path: path, taskID: taskID}
}

// 模型生成证据在锁外完成；工具只提交增量，agent 由运行程序确定。
// 这里只保护读、改、写；若证据依赖旧状态，还需版本条件提交，本示例未实现。
func (s *StateStore) Update(agent, evidence string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.readFile()
	if err != nil {
		return err
	}
	state.Evidence[agent] = evidence
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0600)
}

// 每次从文件解码独立快照；程序将相关记录作为工具结果交给调用模型。
func (s *StateStore) Read() (TaskState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.readFile()
}

// 只允许在持锁时调用。首次读取不存在的文件时，从空记录开始。
func (s *StateStore) readFile() (TaskState, error) {
	state := TaskState{TaskID: s.taskID, Evidence: make(map[string]string)}
	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return state, nil
	}
	if err != nil {
		return state, err
	}
	if err := json.Unmarshal(data, &state); err != nil {
		return state, err
	}
	if state.Evidence == nil {
		state.Evidence = make(map[string]string)
	}
	return state, nil
}
