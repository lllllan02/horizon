import test from 'node:test';
import assert from 'node:assert/strict';
import { Lexer, Parser } from 'marked';
import { parseDocument, renderDocument } from '../src/library.ts';
import { MarkdownTokenizer } from '../src/markdown-tokenizer.ts';

const target = parseDocument('目标正文', 'interviews/target.md');
function render(body: string) {
  const doc = parseDocument(body, 'interviews/source.md');
  return renderDocument(doc, [doc, target]);
}

test('中文标点前的强调保留内部链接、行内代码及其他嵌套样式', () => {
  for (const ending of ['：后文', '，后文', '。', '；', '！', '？', '）', '. End', '']) {
    const result = render(`3. **[[target|选择并提升从节点]]**${ending}`);
    assert.match(result.html, /<li><strong><a [^>]*href="#\/doc\/target"/);
    assert.match(result.html, /选择并提升从节点<\/a><\/strong>/);
    assert.equal(result.references.length, 1);
    assert.equal(result.issues.length, 0);
    assert.match(render(`**\`quorum\`**${ending}`).html, /<strong><code>quorum<\/code><\/strong>/);
    assert.match(render(`**[外链](https://example.com)**${ending}`).html, /<strong><a /);
    assert.match(render(`**~~删除~~**${ending}`).html, /<strong><del>删除<\/del><\/strong>/);
    assert.match(render(`*\`代码\`*${ending}`).html, /<em><code>代码<\/code><\/em>/);
  }
});

test('强调边界分析不改变中文、Unicode 符号、链接目标或代码原文', () => {
  const result = render('（**[[target|选择「从节点」]]**），**\`参数：值😀\`**。**「结论」**。');
  assert.match(result.html, /选择「从节点」<\/a><\/strong>/);
  assert.match(result.html, /<strong><code>参数：值😀<\/code><\/strong>/);
  assert.match(result.html, /<strong>「结论」<\/strong>/);
  assert.match(result.html, /data-copy-source="\[\[target\|选择「从节点」\]\]"/);
  assert.equal(result.body, '（**[[target|选择「从节点」]]**），**`参数：值😀`**。**「结论」**。');
  for (const boundary of ['😀', '𐄀', '。']) {
    assert.match(
      render(`${boundary}**\`代码\`**${boundary}`).html,
      /<strong><code>代码<\/code><\/strong>/,
    );
  }
});

test('嵌套、转义、表格及围栏代码仍遵守原有语法', () => {
  assert.match(render('***\`代码\`***：').html, /<em><strong><code>代码<\/code><\/strong><\/em>/);
  assert.match(render('**重点 *强调* 结论**。').html, /<strong>重点 <em>强调<\/em> 结论<\/strong>/);
  assert.match(render('__\`代码\`__：').html, /<strong><code>代码<\/code><\/strong>/);
  assert.doesNotMatch(render('\\*\\*`原样`\\*\\*：').html, /<strong>/);
  assert.doesNotMatch(render('foo__bar__baz a**`code`**b').html, /<strong>/);
  const table = render('| 标题 |\n| --- |\n| **[[target\\|从节点]]**： |');
  assert.match(table.html, /<td><strong><a /);
  assert.equal(table.references.length, 1);
  const code = render('```text\n**[[missing]]**：\n**`代码`**\n```');
  assert.equal(code.references.length, 0);
  assert.equal(code.issues.length, 0);
  assert.doesNotMatch(code.html, /<strong>|class="wiki-link"/);
  assert.match(code.html, /\*\*\[\[missing\]\]\*\*：/);
});

test('ASCII 强调与 Marked 原生的分隔符和嵌套行为一致', () => {
  for (const body of [
    '***foo** bar*',
    '*foo **bar***',
    '**foo *bar* baz**',
    '***foo***',
    '**foo**bar',
    'foo__bar__baz',
    'a**`code`**b',
    '**foo\\**bar**',
    '\\*\\*literal\\*\\*',
    '**``code ` ** literal``**.',
    '**[link](https://example.com/a_(b))**.',
    '**[link][ref]**.\n\n[ref]: https://example.com',
    '**not closed',
    '** spaced **',
    '___foo___',
    '_foo __bar___',
  ]) {
    assert.equal(
      Parser.parse(Lexer.lex(body, { gfm: true, tokenizer: new MarkdownTokenizer() })),
      Parser.parse(Lexer.lex(body, { gfm: true })),
      body,
    );
  }
});
