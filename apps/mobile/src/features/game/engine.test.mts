/**
 * engine.ts 검증 — 서버 tests/test_rule_engine.py · test_ai_player.py와 같은 케이스 (TC-W-05~12)
 * 앱 단독 버전에서도 판정 규칙이 서버와 똑같아야 한다.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  chooseWord,
  type Dictionary,
  GRACE_MS,
  judge,
  nextCount,
  seededRng,
  WordList,
} from './engine.ts';
import { TEST_WORDS } from './testWords.ts';
import type { Difficulty } from './types';

const DICT = new WordList(TEST_WORDS);
const DEADLINE = 1_000_000;
const SEEDS = Array.from({ length: 30 }, (_, i) => i);
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

function run(
  word: string,
  {
    previousWord = '역량' as string | null,
    used = ['역량'],
    isFirstTurn = false,
    now = DEADLINE - 5_000,
  } = {},
) {
  return judge(word, {
    previousWord,
    used: new Set(used),
    dictionary: DICT,
    isFirstTurn,
    now,
    deadline: DEADLINE,
  });
}

describe('WordList', () => {
  test('2글자 이상만 받고 가나다순으로 돌려준다', () => {
    const d = new WordList(['기차', '기름', '술', '기쁨']);
    assert.equal(d.contains('술'), false);
    assert.deepEqual(d.wordsStartingWith('기'), ['기름', '기쁨', '기차']);
    assert.equal(d.countStartingWith('기'), 3);
    assert.equal(d.countStartingWith('쁨'), 0);
  });
});

describe('judge', () => {
  test('TC-W-05 두음법칙 시작 허용 (역량 → 양말)', () => assert.equal(run('양말'), 'OK'));
  test('같은 글자로 시작', () =>
    assert.equal(run('일기', { previousWord: '내일', used: ['내일'] }), 'OK'));
  test('두음법칙은 한 방향 (양 → 량 불가)', () =>
    assert.equal(run('량말', { previousWord: '미양', used: [] }), 'WRONG_START'));

  for (const word of ['apple', '사과1', '사 과', 'ㄱㄴ', '사과!', '', '사과😀']) {
    test(`TC-W-06 한글 외 문자: ${JSON.stringify(word)}`, () =>
      assert.equal(run(word), 'INVALID_CHARS'));
  }

  test('TC-W-07 한 글자', () => assert.equal(run('양'), 'TOO_SHORT'));
  test('TC-W-08 시작 글자 검사가 사전 검사보다 먼저', () =>
    assert.equal(run('바나쿠'), 'WRONG_START'));
  test('TC-W-09 이미 쓴 단어', () =>
    assert.equal(run('양말', { used: ['역량', '양말'] }), 'ALREADY_USED'));
  test('이미 쓴 단어 검사가 사전 검사보다 먼저', () =>
    assert.equal(run('양파링', { used: ['역량', '양파링'] }), 'ALREADY_USED'));
  test('사전에 없는 단어', () => assert.equal(run('양파링'), 'NOT_IN_DICT'));
  test('TC-W-10 첫 턴 한방단어 금지', () =>
    assert.equal(
      run('기쁨', { previousWord: null, used: [], isFirstTurn: true }),
      'HANBANG_FIRST_TURN',
    ));
  test('첫 턴이 아니면 한방단어 허용', () =>
    assert.equal(run('기쁨', { previousWord: '일기', used: ['일기'] }), 'OK'));
  test('첫 단어는 시작 글자 검사 생략', () =>
    assert.equal(run('사과', { previousWord: null, used: [], isFirstTurn: true }), 'OK'));

  const boundaries: [number, string][] = [
    [500, 'OK'], // TC-W-14 허용치 이내
    [GRACE_MS, 'OK'], // 경계값: 정확히 허용치
    [GRACE_MS + 1, 'TIMEOUT'], // 경계값 바로 뒤
    [1_500, 'TIMEOUT'], // TC-W-13
  ];
  for (const [lateBy, expected] of boundaries) {
    test(`마감 ${lateBy}ms 후 → ${expected}`, () =>
      assert.equal(run('양말', { now: DEADLINE + lateBy }), expected));
  }
  test('시간 초과가 가장 먼저', () =>
    assert.equal(run('apple', { now: DEADLINE + 5_000 }), 'TIMEOUT'));

  for (const [ch, count] of [
    ['기', 4],
    ['량', 1],
    ['름', 1],
    ['쁨', 0],
  ] as const) {
    test(`nextCount(${ch}) = ${count} (두음 포함)`, () => assert.equal(nextCount(DICT, ch), count));
  }
});

function pick(
  previousWord: string,
  difficulty: Difficulty,
  seed = 0,
  { used = [previousWord], isFirstTurn = false, dictionary = DICT as Dictionary } = {},
) {
  return chooseWord({
    previousWord,
    used: new Set(used),
    dictionary,
    difficulty,
    rng: seededRng(seed),
    isFirstTurn,
  });
}

describe('chooseWord', () => {
  for (const d of DIFFICULTIES) {
    test(`TC-W-12 후보가 없으면 null (${d})`, () => assert.equal(pick('기쁨', d), null));
  }
  test('이미 쓴 단어는 제외', () =>
    assert.equal(pick('양말', 'normal', 0, { used: ['양말', '말미'] }), null));
  test('두음 글자로 시작 (례 → 예)', () => assert.equal(pick('차례', 'normal'), '예술'));
  test('어려움은 한방단어를 고른다', () =>
    assert.deepEqual(new Set(SEEDS.map((s) => pick('일기', 'hard', s))), new Set(['기쁨'])));
  test('어려움도 첫 턴에는 한방단어를 피한다', () => {
    const picked = new Set(SEEDS.map((s) => pick('일기', 'hard', s, { isFirstTurn: true })));
    assert.equal(picked.has('기쁨'), false);
    for (const w of picked) assert.ok(['기름', '기차', '기상예보'].includes(w as string));
  });
  test('보통은 한방단어를 쓰지 않고 매번 같지 않다', () => {
    const picked = new Set(SEEDS.map((s) => pick('일기', 'normal', s)));
    assert.equal(picked.has('기쁨'), false);
    assert.ok(picked.size > 1);
  });
  test('쉬움은 3글자 이하만', () => {
    for (const w of SEEDS.map((s) => pick('일기', 'easy', s))) {
      assert.ok(['기름', '기차'].includes(w as string));
    }
  });
  test('쉬움은 잇기 쉬운 끝 글자를 고른다', () => {
    const d = new WordList(['가기', '가락', '기름', '기차', '낙지', '지기', '늠름', '차기']);
    const picked = new Set(SEEDS.map((s) => pick('휴가', 'easy', s, { used: [], dictionary: d })));
    assert.deepEqual(picked, new Set(['가기']));
  });
});

function playAiVsAi(seed: number, difficulty: Difficulty): string[] {
  const rng = seededRng(seed);
  const words = ['사과'];
  for (;;) {
    const word = chooseWord({
      previousWord: words.at(-1) as string,
      used: new Set(words),
      dictionary: DICT,
      difficulty,
      rng,
    });
    if (word === null) return words;
    words.push(word);
  }
}

describe('AI 대 AI', () => {
  for (const d of DIFFICULTIES) {
    test(`TC-W-11 같은 시드면 같은 판 (${d})`, () =>
      assert.deepEqual(playAiVsAi(42, d), playAiVsAi(42, d)));
    test(`AI 단어는 항상 규칙 엔진을 통과 (${d})`, () => {
      for (let seed = 0; seed < 10; seed++) {
        const words = playAiVsAi(seed, d);
        for (let i = 1; i < words.length; i++) {
          const verdict = judge(words[i] as string, {
            previousWord: words[i - 1] as string,
            used: new Set(words.slice(0, i)),
            dictionary: DICT,
            isFirstTurn: false,
            now: 0,
            deadline: 0,
          });
          assert.equal(verdict, 'OK');
        }
      }
    });
  }
});

test('seededRng는 0 이상 1 미만, 같은 시드면 같은 수열', () => {
  const a = seededRng(7);
  const b = seededRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = a();
    assert.ok(v >= 0 && v < 1);
    assert.equal(v, b());
  }
});
