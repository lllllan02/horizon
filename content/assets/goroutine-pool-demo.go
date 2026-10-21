// 自拟面试示例：固定 worker、有界队列、队列满拒绝、优雅关闭。
// 仅依赖标准库，运行：go run content/assets/goroutine-pool-demo.go
// 语义依据：https://go.dev/ref/spec 和 https://pkg.go.dev/sync#WaitGroup
package main

import (
	"errors"
	"fmt"
	"log"
	"runtime/debug"
	"sync"
)

var (
	ErrClosed  = errors.New("pool is closed")
	ErrFull    = errors.New("task queue is full")
	ErrNilTask = errors.New("task is nil")
)

// Pool 必须通过 NewPool 创建，创建后不可复制。
type Pool struct {
	jobs   chan func()    // 有界任务队列。
	mu     sync.Mutex     // 协调提交与关闭。
	closed bool           // 仅在持有 mu 时读写。
	wg     sync.WaitGroup // 记录 worker 是否全部退出。
}

func NewPool(workers, queueSize int) (*Pool, error) {
	if workers <= 0 || queueSize <= 0 {
		return nil, errors.New("workers and queueSize must be positive")
	}
	p := &Pool{jobs: make(chan func(), queueSize)}
	p.wg.Add(workers) // 在启动 worker、允许外部 Wait 之前完成登记。
	for i := 0; i < workers; i++ {
		go func() {
			defer p.wg.Done()
			for task := range p.jobs {
				runTask(task) // 直接执行，不能再 go task() 绕过并发上限。
			}
		}()
	}
	return p, nil
}

// Submit 成功只代表任务已接收，不代表任务已经执行成功。
// 不等待队列空位；仍可能短暂等待互斥锁。
func (p *Pool) Submit(task func()) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.closed {
		return ErrClosed
	}
	if task == nil {
		return ErrNilTask
	}
	select {
	case p.jobs <- task:
		return nil
	default:
		return ErrFull
	}
}

// Close 可重复、并发调用，等待所有已接收任务执行结束。
// 必须由池外调用；任务需最终返回，不能在任务中调用 Close 或 runtime.Goexit。
func (p *Pool) Close() {
	p.mu.Lock()
	if !p.closed {
		p.closed = true
		close(p.jobs) // 与 Submit 用同一把锁，关闭和发送不会重叠。
	}
	p.mu.Unlock()
	p.wg.Wait() // 等待时不能持锁；每个 Close 调用者都要等待。
}

// 每次任务单独恢复普通 panic，记录后让 worker 继续取下一项。
// 不能恢复任务自行启动的其他 goroutine 的 panic，也不重试失败任务。
func runTask(task func()) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("task panic: %v\n%s", r, debug.Stack())
		}
	}()
	task()
}

func main() {
	p, err := NewPool(2, 4)
	if err != nil {
		log.Fatal(err)
	}
	for i := 0; i < 4; i++ {
		n := i
		if err := p.Submit(func() { fmt.Println("task", n) }); err != nil {
			log.Printf("submit task %d: %v", n, err)
		}
	}
	p.Close()
}
