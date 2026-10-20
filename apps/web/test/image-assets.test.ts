import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadLibrary, parseDocument, renderDocument } from '../src/library.ts';
import { pagesLibrary } from '../scripts/build-pages.ts';
import { startServer } from '../server.ts';

test('图片双链与 Markdown 链接提供预览标记，嵌入和其他附件行为保持一致', () => {
  const body = [
    '- [x] [[assets/diagram.png|准备架构图]]',
    '| 图片 |\n| --- |\n| [[assets/diagram.JPEG\\|表格图片]] |',
    '[Markdown 图片](../assets/diagram.webp)',
    '[[assets/diagram.gif|GIF]]',
    '![[assets/diagram.png|320]]',
    '[[assets/file.pdf|PDF]]',
    '[[assets/file.svg|SVG]]',
    '[远程图片](https://example.com/file.png)',
  ].join('\n\n');
  const doc = parseDocument(body, 'notes/first.md');
  const result = renderDocument(doc, [doc]);
  assert.equal(result.references.length, 0);
  assert.equal(result.issues.length, 0);
  assert.equal((result.html.match(/class="wiki-link image-asset-link"/g) || []).length, 4);
  assert.match(result.html, /data-copy-source="\[\[assets\/diagram.png\|准备架构图\]\]"/);
  assert.match(result.html, /data-copy-href="\.\.\/assets\/diagram.webp"/);
  assert.match(result.html, /<img[^>]+width="320"/);
  assert.match(result.html, /target="_blank" rel="noopener">PDF ↗/);
  assert.match(result.html, /target="_blank" rel="noopener">SVG ↗/);
  assert.match(result.html, /href="https:\/\/example.com\/file.png" target="_blank"/);
});

test('图片预览沿用本地附件安全边界与 Pages 引用附件导出', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'horizon-image-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['notes', 'assets']) await mkdir(path.join(root, dir));
  await copyFile(
    new URL('../e2e/fixtures/diagram.png', import.meta.url),
    path.join(root, 'assets/diagram.png'),
  );
  await writeFile(path.join(root, 'private.png'), 'private');
  await symlink(path.join(root, 'private.png'), path.join(root, 'assets/escape.png'));
  await writeFile(path.join(root, 'assets/unused.png'), 'not referenced');
  await writeFile(
    path.join(root, 'notes/first.md'),
    '[[assets/diagram.png|架构图]] [[assets/missing.png]] [[assets/escape.png]] [[../private.png]]',
  );
  const local = await loadLibrary(root);
  const exported = await pagesLibrary(root);
  assert.equal(local.documents.length, 1);
  assert.equal(local.documents[0].references.length, 0);
  assert.deepEqual([...exported.assets.keys()], ['assets/diagram.png']);
  const html = exported.library.documents[0].html;
  assert.match(
    html,
    /class="wiki-link image-asset-link" href="\.\/documents\/assets\/diagram.png"/,
  );
  assert.equal((html.match(/href="#"/g) || []).length, 3);
  assert.doesNotMatch(html, /\/api\/asset/);
  const app = await startServer({ root, port: 0, optimizeDependencies: false, development: true });
  t.after(() => app.close());
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/asset?path=`;
  const response = await fetch(base + encodeURIComponent('assets/diagram.png'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^image\/png/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.ok((await response.arrayBuffer()).byteLength > 100);
  for (const file of [
    'assets/missing.png',
    'assets/escape.png',
    'private.png',
    '../../private.png',
  ])
    assert.equal((await fetch(base + encodeURIComponent(file))).status, 404, file);
});
