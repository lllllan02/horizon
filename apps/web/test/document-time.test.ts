import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDocumentTime } from '../src/neural/document-time.ts';
import { activityDay } from '../src/neural/activity-model.ts';

test('文档时间统一显示北京时间，跨日转换并保留秒，不展示时区标记', () => {
  assert.equal(formatDocumentTime('2026-10-20T17:02:03.123Z'), '2026-10-21 01:02:03');
  assert.equal(formatDocumentTime('2026-10-21T01:02:03+08:00'), '2026-10-21 01:02:03');
  assert.equal(formatDocumentTime('2026-10-20T13:02:03-04:00'), '2026-10-21 01:02:03');
  assert.equal(formatDocumentTime('2026-10-21T01:02:03'), '2026-10-21 01:02:03');
  assert.equal(activityDay('2026-10-21T01:02:03'), '2026-10-21');
  assert.equal(formatDocumentTime('2026-10-21 01:02:03.123'), '2026-10-21 01:02:03');
  assert.equal(activityDay('2026-10-21 01:02:03.123'), '2026-10-21');
});

test('日期保留原精度，缺失及无效值不伪造时间', () => {
  assert.equal(formatDocumentTime('2026-10-21'), '2026-10-21');
  for (const value of [null, undefined, '', 'invalid', '2026-02-30'])
    assert.equal(formatDocumentTime(value), null);
});
