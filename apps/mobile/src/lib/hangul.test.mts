/**
 * hangul.ts 검증 — 서버 tests/test_dueum.py와 같은 shared/hangul-vectors.json을 읽는다.
 *
 * Jest 대신 Node 내장 테스트 러너(node:test)를 쓰는 이유: 순수 함수만 검사하므로
 * 새 의존성 없이 Node의 타입 제거(type stripping)만으로 .ts를 바로 실행할 수 있다.
 * 확장자가 .mts인 이유: package.json에 "type": "module"을 넣지 않고도 ESM으로 실행되게 하려고.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import { allowedStarts, compose, decompose, dueum, isHangulSyllable } from './hangul.ts';

interface Vectors {
  decompose: { char: string; cho: number; jung: number; jong: number }[];
  dueum: { input: string; output: string }[];
  allowedStarts: { input: string; output: string[] }[];
}

const vectors = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../shared/hangul-vectors.json'), 'utf8'),
) as Vectors;

describe('공유 벡터 (서버와 같은 결과)', () => {
  for (const v of vectors.decompose) {
    test(`decompose ${v.char}`, () => {
      assert.deepEqual(decompose(v.char), [v.cho, v.jung, v.jong]);
    });
  }
  // TC-W-01(력→역), TC-W-02(름→늠), TC-W-03(녀→여), TC-W-04(러: 변환 없음) 포함
  for (const v of vectors.dueum) {
    test(`dueum ${v.input} → ${v.output}`, () => {
      assert.equal(dueum(v.input), v.output);
    });
  }
  for (const v of vectors.allowedStarts) {
    test(`allowedStarts ${v.input}`, () => {
      assert.deepEqual(allowedStarts(v.input), v.output);
    });
  }
});

describe('전수 검사 (완성형 11,172자)', () => {
  const all = Array.from({ length: 0xd7a3 - 0xac00 + 1 }, (_, i) =>
    String.fromCharCode(0xac00 + i),
  );

  test('compose(decompose(c)) === c', () => {
    for (const c of all) assert.equal(compose(...decompose(c)), c);
  });

  test('두음법칙은 받침을 바꾸지 않고, 두 번 적용해도 같다', () => {
    for (const c of all) {
      const d = dueum(c);
      assert.equal(decompose(d)[2], decompose(c)[2]);
      assert.equal(dueum(d), d);
    }
  });

  test('허용 시작 글자의 맨 앞은 항상 원래 글자', () => {
    for (const c of all) assert.equal(allowedStarts(c)[0], c);
  });
});

describe('경계값', () => {
  test('완성형 범위 밖은 한글 음절이 아니다', () => {
    for (const ch of ['', 'ㄱ', 'ㅏ', 'a', '가나', '꯿', '힤', '😀']) {
      assert.equal(isHangulSyllable(ch), false, JSON.stringify(ch));
    }
    assert.equal(isHangulSyllable('가'), true);
    assert.equal(isHangulSyllable('힣'), true);
  });

  test('잘못된 입력은 RangeError', () => {
    assert.throws(() => decompose('a'), RangeError);
    assert.throws(() => compose(19, 0), RangeError);
    assert.throws(() => compose(0, 21), RangeError);
    assert.throws(() => compose(0, 0, 28), RangeError);
    assert.throws(() => compose(-1, 0), RangeError);
  });
});
