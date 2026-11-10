/** logic.ts 검증 — 라우트 파라미터 검증, 판정·오류 문구 (G-02, G-03) */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  errorMessage,
  isValidGameId,
  parseDifficulty,
  startsCorrectly,
  verdictMessage,
} from './logic.ts';

describe('라우트 파라미터 검증', () => {
  test('난이도는 세 가지만', () => {
    assert.equal(parseDifficulty('hard'), 'hard');
    for (const v of ['HARD', 'insane', '', undefined, ['easy'], 1]) {
      assert.equal(parseDifficulty(v), null, String(v));
    }
  });

  test('게임 ID는 서버 형식(hex 32자)만', () => {
    assert.equal(isValidGameId('0123456789abcdef0123456789abcdef'), true);
    for (const v of [
      'new',
      '../result/x',
      '0123456789abcdef0123456789abcde', // 31자
      '0123456789ABCDEF0123456789ABCDEF', // 대문자
      '0123456789abcdef0123456789abcdef/forfeit',
      undefined,
    ]) {
      assert.equal(isValidGameId(v), false, String(v));
    }
  });
});

describe('시작 글자 즉시 검사', () => {
  test('첫 턴은 아무 글자나', () => {
    assert.equal(startsCorrectly('사과', []), true);
  });

  test('두음법칙 글자도 허용', () => {
    assert.equal(startsCorrectly('양말', ['량', '양']), true);
    assert.equal(startsCorrectly('말미', ['량', '양']), false);
  });
});

describe('문구', () => {
  test('WRONG_START는 허용 글자를 함께 안내', () => {
    assert.equal(verdictMessage('WRONG_START', ['량', '양']), "'량' 또는 '양'(으)로 시작해야 해요");
  });

  test('오류는 코드로만 문구를 고르고 서버 message는 쓰지 않는다', () => {
    const msg = errorMessage({ code: 'TURN_MISMATCH', message: '<script>서버 문구</script>' });
    assert.ok(!msg.includes('서버 문구'));
    assert.match(errorMessage({ code: 'RATE_LIMITED' }), /잠시 후/);
    assert.match(errorMessage(new Error('boom')), /문제가 생겼어요/);
    assert.match(errorMessage(null), /문제가 생겼어요/);
  });
});
