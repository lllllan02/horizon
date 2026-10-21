import test from 'node:test';
import assert from 'node:assert/strict';
import { beijingTimestamp, documentTime, stateChangeTimestamp } from '../src/document-dates.ts';

test('无偏移时间按北京时间解析，兼容旧偏移且纯日期落在北京零点', () => {
  for (const zone of ['UTC', 'America/New_York', 'Asia/Shanghai']) {
    const previous = process.env.TZ;
    try {
      process.env.TZ = zone;
      const midnight = documentTime('2026-10-21T00:00:00+08:00');
      assert.equal(documentTime('2026-10-21'), midnight);
      assert.equal(documentTime('2026-10-21T00:00:00'), midnight);
      assert.equal(documentTime('2026-10-21 00:00:00'), midnight);
      assert.equal(documentTime('2026-10-21 00:00:00.123'), midnight + 123);
      assert.equal(documentTime('2026-10-20T16:00:00Z'), midnight);
      assert.equal(documentTime('2026-10-20T11:00:00-05:00'), midnight);
      assert.equal(beijingTimestamp(midnight), '2026-10-21 00:00:00.000');
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  }
  for (const value of ['2026-02-30', '2026-02-30T10:00:00', 'unknown', null])
    assert.ok(Number.isNaN(documentTime(value)));
});

test('北京时间生成器保留毫秒和真实时刻，状态时间复用相同格式', () => {
  const now = Date.parse('2026-10-20T16:00:00.123Z');
  assert.equal(beijingTimestamp(now), '2026-10-21 00:00:00.123');
  assert.equal(documentTime(beijingTimestamp(now)), now);
  assert.equal(stateChangeTimestamp(now), beijingTimestamp(now));
});
