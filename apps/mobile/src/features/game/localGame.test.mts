/**
 * localGame.ts 검증 — 서버 tests/test_games_api.py와 같은 흐름 (G-01, G-03~G-07, TC-W-13~17)
 * 가짜 시계를 써서 '마감 1.5초 후' 같은 경계값을 기다리지 않고 재현한다.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { WordList } from './engine.ts';
import { createLocalGame } from './localGame.ts';
import { TEST_WORDS } from './testWords.ts';
import type { Difficulty } from './types';

function setup() {
  const clock = { now: 1_700_000_000_000 };
  let loads = 0;
  const game = createLocalGame({
    loadDictionary: () => {
      loads += 1;
      return new WordList(TEST_WORDS);
    },
    now: () => clock.now,
  });
  const advance = (ms: number) => (clock.now += ms);
  return { game, clock, advance, loads: () => loads };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    return (e as { code: string }).code;
  }
  return 'NO_ERROR';
}

describe('게임 생성 (G-01)', () => {
  test('초기 상태', async () => {
    const { game, clock } = setup();
    const s = await game.createGame('normal');

    assert.match(s.gameId, /^[0-9a-f]{32}$/);
    assert.equal(s.status, 'playing');
    assert.equal(s.lives, 3);
    assert.equal(s.maxLives, 3);
    assert.equal(s.turnSeconds, 15);
    assert.equal(s.turn, 1);
    assert.deepEqual(s.chain, []);
    assert.equal(s.deadlineAt, clock.now + 15_000);
  });

  test('어려움은 10초', async () => {
    const { game, clock } = setup();
    const s = await game.createGame('hard');
    assert.equal(s.turnSeconds, 10);
    assert.equal(s.deadlineAt, clock.now + 10_000);
  });

  test('사전은 한 번만 읽는다', async () => {
    const { game, loads } = setup();
    await game.createGame('easy');
    await game.createGame('easy');
    assert.equal(loads(), 1);
  });
});

describe('턴 진행 (G-03 · G-04 · G-06)', () => {
  test('맞는 단어 → AI 응답과 새 마감', async () => {
    const { game, clock, advance } = setup();
    const { gameId } = await game.createGame('normal');
    advance(5_000);

    const res = await game.submitMove(gameId, 1, '역량');

    assert.equal(res.verdict, 'OK');
    assert.equal(res.aiWord, '양말'); // 량/양으로 시작하는 단어는 양말뿐
    assert.equal(res.game.turn, 2);
    assert.equal(res.game.lastWord, '양말');
    assert.deepEqual(res.game.allowedStarts, ['말']);
    assert.deepEqual(
      res.game.chain.map((w) => w.speaker),
      ['player', 'ai'],
    );
    assert.equal(res.game.deadlineAt, clock.now + 15_000);
  });

  const scores: [Difficulty, string, number][] = [
    ['easy', '역량', 20],
    ['normal', '역량', 30],
    ['hard', '역량', 40],
    ['normal', '기상예보', 60], // 4글자 × 10 × 1.5
  ];
  for (const [difficulty, word, expected] of scores) {
    test(`점수: ${difficulty} ${word} → ${expected}`, async () => {
      const { game } = setup();
      const { gameId } = await game.createGame(difficulty);
      const res = await game.submitMove(gameId, 1, word);
      assert.equal(res.verdict, 'OK');
      assert.equal(res.game.score, expected);
    });
  }

  test('앞뒤 공백은 지운다', async () => {
    const { game } = setup();
    const { gameId } = await game.createGame('normal');
    assert.equal((await game.submitMove(gameId, 1, '  역량 ')).verdict, 'OK');
  });

  test('자모가 분리된(NFD) 한글도 같은 단어로 판정한다 (QA DEF-006)', async () => {
    const { game } = setup();
    const { gameId } = await game.createGame('normal');
    assert.equal((await game.submitMove(gameId, 1, '역량'.normalize('NFD'))).verdict, 'OK');
  });

  test('무효 단어는 목숨 1개, 턴 +1, 마감은 그대로, 점수 없음', async () => {
    const { game } = setup();
    const created = await game.createGame('normal');
    const res = await game.submitMove(created.gameId, 1, '기쁨');

    assert.equal(res.verdict, 'HANBANG_FIRST_TURN');
    assert.equal(res.aiWord, null);
    assert.equal(res.game.lives, 2);
    assert.equal(res.game.turn, 2);
    assert.equal(res.game.score, 0);
    assert.equal(res.game.deadlineAt, created.deadlineAt);
  });

  test('AI가 낼 단어가 없으면 승리 (TC-W-12)', async () => {
    const { game } = setup();
    const { gameId } = await game.createGame('normal');

    assert.equal((await game.submitMove(gameId, 1, '사과')).aiWord, '과자');
    assert.equal((await game.submitMove(gameId, 2, '자리')).aiWord, '이름');
    const res = await game.submitMove(gameId, 3, '늠름'); // 름/늠으로 시작하는 단어는 늠름뿐

    assert.equal(res.aiWord, null);
    assert.equal(res.game.status, 'won');
    assert.equal(res.game.endReason, 'ai_stuck');
    assert.equal(res.game.score, 240); // (20 × 3 + 100) × 1.5
  });

  test('TC-W-15 무효 3번이면 패배', async () => {
    const { game } = setup();
    const { gameId } = await game.createGame('normal');
    await game.submitMove(gameId, 1, '없는말');
    await game.submitMove(gameId, 2, '없는말');
    const last = await game.submitMove(gameId, 3, 'abc');

    assert.equal(last.verdict, 'INVALID_CHARS');
    assert.equal(last.game.lives, 0);
    assert.equal(last.game.status, 'lost');
    assert.equal(last.game.endReason, 'no_lives');
  });
});

describe('시간 (G-05)', () => {
  test('TC-W-13 허용치가 지난 제출은 시간 초과', async () => {
    const { game, advance } = setup();
    const { gameId } = await game.createGame('normal');
    advance(15_000 + 1_500);
    const res = await game.submitMove(gameId, 1, '역량');

    assert.equal(res.verdict, 'TIMEOUT');
    assert.equal(res.game.status, 'lost');
    assert.equal(res.game.endReason, 'timeout');
  });

  test('TC-W-14 허용치 안의 제출은 판정한다', async () => {
    const { game, advance } = setup();
    const { gameId } = await game.createGame('normal');
    advance(15_000 + 500);
    const res = await game.submitMove(gameId, 1, '역량');
    assert.equal(res.verdict, 'OK');
    assert.equal(res.game.status, 'playing');
  });

  test('마감 뒤 조회하면 시간 초과로 확정', async () => {
    const { game, advance } = setup();
    const { gameId } = await game.createGame('normal');
    advance(15_000 + 1_001);
    const s = await game.getGame(gameId);
    assert.equal(s.status, 'lost');
    assert.equal(s.endReason, 'timeout');
  });
});

describe('오류', () => {
  test('TC-W-16 같은 턴을 두 번 보내면 거절, 목숨은 한 번만 깎인다', async () => {
    const { game } = setup();
    const { gameId } = await game.createGame('normal');
    await game.submitMove(gameId, 1, '없는말');

    assert.equal(await codeOf(game.submitMove(gameId, 1, '없는말')), 'TURN_MISMATCH');
    assert.equal((await game.getGame(gameId)).lives, 2);
  });

  test('TC-W-17 30분이 지나면 게임이 사라진다', async () => {
    const { game, advance } = setup();
    const { gameId } = await game.createGame('normal');
    advance(30 * 60_000);
    assert.equal((await game.getGame(gameId)).gameId, gameId);
    advance(60_000);
    assert.equal(await codeOf(game.getGame(gameId)), 'GAME_NOT_FOUND');
  });

  test('만료는 마지막 제출 기준: 30분 넘게 이어지는 판도 사라지지 않는다 (QA DEF-001)', async () => {
    const { game, advance } = setup();
    const { gameId } = await game.createGame('normal');
    advance(29 * 60_000);
    await game.submitMove(gameId, 1, '역량');
    advance(29 * 60_000);
    assert.equal((await game.getGame(gameId)).gameId, gameId);
    advance(2 * 60_000);
    assert.equal(await codeOf(game.getGame(gameId)), 'GAME_NOT_FOUND');
  });

  test('없는 게임', async () => {
    const { game } = setup();
    assert.equal(await codeOf(game.getGame('0'.repeat(32))), 'GAME_NOT_FOUND');
  });

  test('끝난 게임에 제출하면 거절', async () => {
    const { game } = setup();
    const { gameId } = await game.createGame('normal');
    await game.forfeit(gameId);
    assert.equal(await codeOf(game.submitMove(gameId, 1, '역량')), 'GAME_ALREADY_ENDED');
  });
});

describe('기권 · 결과 (G-06 · G-07)', () => {
  test('기권은 한 번만', async () => {
    const { game } = setup();
    const { gameId } = await game.createGame('normal');
    const first = await game.forfeit(gameId);

    assert.equal(first.status, 'lost');
    assert.equal(first.endReason, 'forfeit');
    assert.equal(await codeOf(game.forfeit(gameId)), 'GAME_ALREADY_ENDED');
  });

  test('마감 뒤 기권은 시간 초과로 기록', async () => {
    const { game, advance } = setup();
    const { gameId } = await game.createGame('normal');
    advance(20_000);
    assert.equal((await game.forfeit(gameId)).endReason, 'timeout');
  });

  test('결과: 단어 목록과 점수, 뜻풀이는 비어 있다', async () => {
    const { game } = setup();
    const { gameId } = await game.createGame('normal');
    await game.submitMove(gameId, 1, '역량');
    await game.forfeit(gameId);

    const result = await game.getResult(gameId);
    assert.equal(result.outcome, 'lost');
    assert.equal(result.reason, 'forfeit');
    assert.equal(result.score, 30); // 패배해도 받아들여진 단어 점수는 남는다
    assert.deepEqual(result.words, [
      { turn: 1, speaker: 'player', word: '역량', definition: '' },
      { turn: 2, speaker: 'ai', word: '양말', definition: '' },
    ]);
  });

  test('진행 중인 게임의 결과는 거절', async () => {
    const { game } = setup();
    const { gameId } = await game.createGame('normal');
    assert.equal(await codeOf(game.getResult(gameId)), 'GAME_IN_PROGRESS');
  });

  test('화면이 받은 상태를 바꿔도 진행 중인 판은 그대로', async () => {
    const { game } = setup();
    const { gameId } = await game.createGame('normal');
    const res = await game.submitMove(gameId, 1, '역량');
    res.game.chain.pop();
    res.game.allowedStarts.push('가');

    const s = await game.getGame(gameId);
    assert.equal(s.chain.length, 2);
    assert.deepEqual(s.allowedStarts, ['말']);
  });
});
