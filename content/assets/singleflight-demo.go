// 参照官方 singleflight 的核心流程整理，仅展示正常返回路径。
// 省略 shared 返回值及其他接口、异常处理。
// https://github.com/golang/sync/blob/v0.17.0/singleflight/singleflight.go
package singleflight

import "sync"

// 用锁保护正在执行的任务表。
type Group struct {
	mu sync.Mutex
	m  map[string]*call
}

type call struct {
	wg  sync.WaitGroup // 等待这一次任务完成。
	val any
	err error
}

func (g *Group) Do(key string, fn func() (any, error)) (any, error) {
	g.mu.Lock()
	if g.m == nil {
		g.m = make(map[string]*call)
	}

	// 已有任务：解锁后等待，共用结果。
	if c, ok := g.m[key]; ok {
		g.mu.Unlock()
		c.wg.Wait()
		return c.val, c.err
	}

	// 没有任务：设置等待计数，在锁内登记任务。
	c := new(call)
	c.wg.Add(1)
	g.m[key] = c
	g.mu.Unlock()

	// 解锁后执行查询，不阻塞其他 key 的任务。
	c.val, c.err = fn()

	// 保存结果后，唤醒等待者，并移除任务登记。
	g.mu.Lock()
	c.wg.Done()
	delete(g.m, key)
	g.mu.Unlock()
	return c.val, c.err
}
