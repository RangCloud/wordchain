/** bestScores.ts 검증 — 최고 기록 갱신 규칙과 깨진 저장값 처리 (G-08) */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { applyScore, EMPTY_RECORD, parseRecord } from './bestScores.ts';

describe('applyScore', () => {
  test('첫 기록은 갱신', () => {
    const { record, isNewBest } = applyScore(EMPTY_RECORD, 'g1', 'normal', 120);

    assert.equal(isNewBest, true);
    assert.equal(record.scores.normal, 120);
    assert.equal(record.scores.easy, null);
  });

  test('더 높을 때만 갱신, 같은 점수는 갱신 아님', () => {
    const first = applyScore(EMPTY_RECORD, 'g1', 'hard', 100).record;

    assert.equal(applyScore(first, 'g2', 'hard', 100).isNewBest, false);
    assert.equal(applyScore(first, 'g3', 'hard', 101).isNewBest, true);
    assert.equal(applyScore(first, 'g4', 'hard', 99).record.scores.hard, 100);
  });

  test('0점은 기록으로 치지 않는다', () => {
    assert.equal(applyScore(EMPTY_RECORD, 'g1', 'easy', 0).isNewBest, false);
  });

  test('같은 판을 다시 반영해도 결과가 같다 (결과 화면 재진입)', () => {
    const once = applyScore(EMPTY_RECORD, 'g1', 'normal', 50);
    const again = applyScore(once.record, 'g1', 'normal', 50);

    assert.equal(again.isNewBest, true);
    assert.equal(again.record, once.record);
  });
});

describe('parseRecord (기기 저장값은 믿지 않는다)', () => {
  test('저장된 값이 없으면 기록 없음', () => {
    assert.deepEqual(parseRecord(null), EMPTY_RECORD);
  });

  test('정상 값은 그대로 읽는다', () => {
    const raw = JSON.stringify({
      scores: { easy: 10, normal: null, hard: 30 },
      lastGame: { gameId: 'g1', isNewBest: true },
    });

    assert.deepEqual(parseRecord(raw), {
      scores: { easy: 10, normal: null, hard: 30 },
      lastGame: { gameId: 'g1', isNewBest: true },
    });
  });

  test('깨지거나 조작된 값은 버린다', () => {
    for (const raw of ['{', 'null', '[]', '"x"']) {
      assert.deepEqual(parseRecord(raw), EMPTY_RECORD, raw);
    }
    const tampered = parseRecord(
      JSON.stringify({
        scores: { easy: -5, normal: 1.5, hard: 99_999_999 },
        lastGame: { gameId: 1 },
      }),
    );
    assert.deepEqual(tampered, EMPTY_RECORD);
  });
});
