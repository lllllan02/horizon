// Go runtime 中 hchan 与 waitq 的结构节选，补充中文注释。
// 来源：https://go.dev/src/runtime/chan.go#L34（2026-10-19 查阅）
// 原源码 Copyright The Go Authors，采用 BSD 风格许可证。
// 保留本次查阅版本的全部结构字段；只展示定义，不包含收发实现。
// _type、timer、synctestBubble、sudog、mutex 均为 runtime 内部类型，
// 本文件供阅读，不能作为独立 Go 程序编译运行。
package runtime

import "unsafe"

type hchan struct {
	qcount   uint            // 缓冲区中当前已有的元素数量。
	dataqsiz uint            // 环形缓冲区容量；无缓冲 Channel 为 0。
	buf      unsafe.Pointer  // 指向存放元素的数组。
	elemsize uint16          // 单个元素的大小，单位为字节。
	closed   uint32          // 关闭标记：0 表示未关闭，1 表示已关闭。
	timer    *timer          // 向这个 Channel 提供事件的定时器，普通 Channel 通常不使用。
	elemtype *_type          // 元素的运行时类型信息。
	sendx    uint            // 下一次向缓冲区写入的位置，到末尾后回到 0。
	recvx    uint            // 下一次从缓冲区读取的位置，到末尾后回到 0。
	recvq    waitq           // 等待接收的队列，节点是 *sudog。
	sendq    waitq           // 等待发送的队列，节点是 *sudog。
	bubble   *synctestBubble // testing/synctest 使用的测试隔离环境信息。

	// 保护 hchan 的共享状态，以及阻塞在此 Channel 上的部分 sudog 字段。
	// runtime 的 mutex，不能直接等同于用户代码中的 sync.Mutex。
	lock mutex
}

// 等待队列保存首尾节点；sudog 关联等待的 goroutine 与收发数据。
type waitq struct {
	first *sudog // 队首。
	last  *sudog // 队尾。
}
