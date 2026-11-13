/** settings.ts 검증 — 기기에 저장된 설정값을 믿지 않고 기본값으로 되돌리는지 (G-10, QA DEF-003) */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { DEFAULT_SETTINGS, parseSettings } from './settings.ts';

describe('parseSettings', () => {
  test('저장값이 없으면 기본값(진동 켬)', () => {
    assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
    assert.equal(DEFAULT_SETTINGS.haptics, true);
  });

  test('저장한 값을 그대로 읽는다', () => {
    assert.deepEqual(parseSettings('{"haptics":false}'), { haptics: false });
  });

  test('깨진 값·잘못된 형식은 기본값', () => {
    for (const raw of ['', '{', 'null', '[]', '1', '"x"', '{"haptics":"no"}', '{"other":1}']) {
      assert.deepEqual(parseSettings(raw), DEFAULT_SETTINGS, raw);
    }
  });
});
