import { e2ePort } from './e2e-settings.ts';
// The browser suite serves only these disposable notes, never the private knowledge base.
import { mkdtemp, mkdir, writeFile, rm, copyFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import { pagesLibrary } from './build-pages.ts';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(path.join(os.tmpdir(), 'horizon-browser-'));
const root = path.join(temp, 'content'),
  outDir = path.join(temp, 'site');
await mkdir(path.join(root, 'readings'), { recursive: true });
await mkdir(path.join(root, 'notes'), { recursive: true });
await writeFile(
  path.join(root, 'notes/first.md'),
  `---
title: 回归起点
category: 验收
aliases: [自动化入口]
reading_suggestions: [second]
tags: [回归]
---
# 回归起点
这是独立测试正文。继续阅读 [[second|回归终点]]。

[[assets/demo.go|完整代码]] · [[assets/missing.go|缺失代码]]

[[assets/diagram.png|架构图片]] · [[assets/missing.png|缺失图片]] · [[assets/broken.png|损坏图片]]

\`\`\`mermaid
flowchart LR
  Start --> Finish
\`\`\`

\`\`\`mermaid
sequenceDiagram
  User->>Reader: Open
  Reader-->>User: Document
\`\`\`

\`\`\`mermaid
packet-beta
0-15: "Source Port"
16-31: "Destination Port"
\`\`\`

\`\`\`mermaid
---
config:
  layout: elk
---
flowchart TD
  Start --> Finish
\`\`\`

## 复制格式

3. **[[second|选择并提升从节点]]**：确认新的主节点。

😀**\`quorum\`**：确认故障所需的哨兵数量。

**「读未提交（Read Uncommitted）」**允许读取其他事务尚未提交的数据。

正文**「重点」**后文，**（重点）**后文，**“重点”**后文。

按 **实际能力** 分类，只开放 [[second|任务所需能力]]：

- 纯计算、格式转换。
- 读取、检索资源。
  - 嵌套能力与 \`参数\`。
- 新增、修改资源。

3. 重复内容。
4. 重复内容与 [章节](second#回归终点) 和 [外部资料](https://example.com/a?q=1&x=2)。

> 引用 **强调**。

\`\`\`ts
const marker = "\`\`\`";

const result = 1;
\`\`\`

| 能力 | 目标 |
| --- | --- |
| 读取 | [[second\\|文档]] |

- [x] 已检查
- [ ] 待检查
`,
);
await writeFile(
  path.join(root, 'notes/emphasis.md'),
  `---
title: 内链加粗验收
category: 验收
---
# 内链加粗验收

- **[[second|Controller]]**负责管理集群。
- [[second|普通内链]]保留原有样式。
- **普通加粗**用于比较字重。
- 正文**[[second|中文紧贴内链]]**后文。
- ***[[second|嵌套强调内链]]***仍然加粗。
`,
);
await writeFile(
  path.join(root, 'notes/headings.md'),
  `---
title: 标题层级验收
category: 验收
---
# 标题层级验收

正文与标题应在不同阅读字号下保持层次。

## 工具和程序的升级策略

这是章节介绍，下面的三种策略属于同一章节。

### 停止支持旧工具

旧调用到达时返回工具已停用，并提供当前可用的工具定义。

#### 参数与返回结果

比较调用参数和返回格式。

##### 输入校验

检查必填参数。

###### 边界情况

保留异常处理与反馈。

### 保留兼容版本

新任务使用新版本，旧任务继续使用历史版本。

## 包含非常长中文标题以及 LongUnbrokenHeadingIdentifierForResponsiveLayoutVerification 的下一章节

这是新的大节。
`,
);
await writeFile(
  path.join(root, 'notes/second.md'),
  `---
learning_status: reading
title: 回归终点
category: 验收
---
# 回归终点
终点正文。返回 [[first|回归起点]]。

预览 [[emphasis|内链加粗验收]]。
`,
);
await mkdir(path.join(root, 'assets'));
await writeFile(
  path.join(root, 'assets/demo.go'),
  'package main\n// <script>window.codeExecuted = true</script>\nfunc main() {}\n',
);
await copyFile(path.join(app, 'e2e/fixtures/diagram.png'), path.join(root, 'assets/diagram.png'));
await writeFile(path.join(root, 'assets/broken.png'), 'not an image');
try {
  await build({ root: app, mode: 'pages', build: { outDir, emptyOutDir: true } });
  const { library, assets } = await pagesLibrary(root);
  for (const [relative, file] of assets) {
    const destination = path.join(outDir, 'documents', relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(file, destination);
  }
  await writeFile(path.join(outDir, 'library.json'), JSON.stringify(library));
  const server = await preview({
    root: app,
    mode: 'pages',
    build: { outDir },
    preview: { host: '127.0.0.1', port: e2ePort, strictPort: true },
  });
  const close = async () => {
    server.httpServer.close();
    await rm(temp, { recursive: true, force: true });
    process.exit(0);
  };
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
} catch (error) {
  await rm(temp, { recursive: true, force: true });
  throw error;
}
