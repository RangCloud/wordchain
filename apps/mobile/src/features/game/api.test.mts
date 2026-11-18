/** api.ts 검증 — 가짜 fetch로 요청 형식과 응답 변환을 확인한다 (실제 서버 불필요) */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ApiError, createGameApi, parseIsoMs, type RawGameState, toGameState } from './api.ts';

const RAW_STATE: RawGameState = {
  game_id: 'g1',
  difficulty: 'normal',
  status: 'playing',
  end_reason: null,
  turn: 2,
  lives: 3,
  max_lives: 3,
  turn_seconds: 15,
  score: 30,
  // 서버(Python)가 실제로 보내는 마이크로초 6자리 형식
  deadline: '2026-01-01T00:00:15.500000Z',
  server_time: '2026-01-01T00:00:00.250000Z',
  last_word: '양말',
  allowed_starts: ['말'],
  moves: [
    { word: '역량', by: 'player' },
    { word: '양말', by: 'ai' },
  ],
};

interface Call {
  url: string;
  init: RequestInit | undefined;
}

function fakeFetch(status: number, body: unknown, calls: Call[] = []): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(body === undefined ? 'not json' : JSON.stringify(body), { status });
  }) as typeof fetch;
}

describe('parseIsoMs', () => {
  test('마이크로초를 밀리초로 잘라 읽는다', () => {
    assert.equal(parseIsoMs('2026-01-01T00:00:00.123456Z'), Date.UTC(2026, 0, 1, 0, 0, 0, 123));
  });

  test('소수점이 없어도 읽는다', () => {
    assert.equal(parseIsoMs('2026-01-01T00:00:01+00:00'), Date.UTC(2026, 0, 1, 0, 0, 1));
  });

  test('읽을 수 없으면 BAD_RESPONSE', () => {
    assert.throws(() => parseIsoMs('nope'), { code: 'BAD_RESPONSE' });
  });
});

describe('toGameState', () => {
  test('마감 시각은 기기 시계 + 서버가 본 남은 시간', () => {
    // 기기 시계가 서버보다 한참 어긋나 있어도 남은 시간(15.25초)은 그대로다
    const state = toGameState(RAW_STATE, 1_000_000);

    assert.equal(state.deadlineAt, 1_000_000 + 15_250);
  });

  test('snake_case를 앱 타입으로 바꾸고 체인에 턴 번호를 붙인다', () => {
    const state = toGameState({ ...RAW_STATE, end_reason: 'NO_LIVES', status: 'lost' }, 0);

    assert.equal(state.gameId, 'g1');
    assert.equal(state.endReason, 'no_lives');
    assert.equal(state.maxLives, 3);
    assert.equal(state.turnSeconds, 15);
    assert.equal(state.lastWord, '양말');
    assert.deepEqual(state.chain, [
      { turn: 1, speaker: 'player', word: '역량' },
      { turn: 2, speaker: 'ai', word: '양말' },
    ]);
  });
});

describe('createGameApi', () => {
  test('게임 생성: POST /v1/games, 주소 끝의 / 는 무시', async () => {
    const calls: Call[] = [];
    const api = createGameApi({
      baseUrl: 'http://api.test/',
      fetchImpl: fakeFetch(201, RAW_STATE, calls),
      now: () => 0,
    });

    const state = await api.createGame('hard');

    assert.equal(calls[0]?.url, 'http://api.test/v1/games');
    assert.equal(calls[0]?.init?.method, 'POST');
    assert.equal(calls[0]?.init?.body, JSON.stringify({ difficulty: 'hard' }));
    assert.equal(state.gameId, 'g1');
  });

  test('단어 제출: 턴과 앞뒤 공백을 뺀 단어를 보내고 판정 결과를 돌려준다', async () => {
    const calls: Call[] = [];
    const api = createGameApi({
      baseUrl: 'http://api.test',
      fetchImpl: fakeFetch(200, { verdict: 'OK', ai_word: '양말', game: RAW_STATE }, calls),
    });

    const result = await api.submitMove('g1', 1, ' 역량 ');

    assert.equal(calls[0]?.url, 'http://api.test/v1/games/g1/moves');
    assert.equal(calls[0]?.init?.body, JSON.stringify({ turn: 1, word: '역량' }));
    assert.equal(result.verdict, 'OK');
    assert.equal(result.aiWord, '양말');
  });

  test('게임 ID는 경로에 넣기 전에 인코딩한다', async () => {
    const calls: Call[] = [];
    const api = createGameApi({
      baseUrl: 'http://api.test',
      fetchImpl: fakeFetch(200, RAW_STATE, calls),
    });

    await api.getGame('a/b');

    assert.equal(calls[0]?.url, 'http://api.test/v1/games/a%2Fb');
  });

  test('결과: 종료 사유를 소문자로, 뜻이 없으면 안내 문구로', async () => {
    const api = createGameApi({
      baseUrl: 'http://api.test',
      fetchImpl: fakeFetch(200, {
        game_id: 'g1',
        difficulty: 'normal',
        status: 'won',
        end_reason: 'AI_STUCK',
        score: 240,
        words: [{ word: '늠름', by: 'player', definition: null }],
      }),
    });

    const result = await api.getResult('g1');

    assert.equal(result.outcome, 'won');
    assert.equal(result.reason, 'ai_stuck');
    assert.equal(result.words[0]?.definition, '뜻풀이가 없어요');
  });

  test('서버 오류 형식은 code·status를 담은 ApiError로', async () => {
    const api = createGameApi({
      baseUrl: 'http://api.test',
      fetchImpl: fakeFetch(409, {
        error: { code: 'TURN_MISMATCH', message: '이미 처리된 요청입니다.', request_id: 'x' },
      }),
    });

    await assert.rejects(api.submitMove('g1', 1, '역량'), (e: unknown) => {
      assert.ok(e instanceof ApiError);
      assert.equal(e.code, 'TURN_MISMATCH');
      assert.equal(e.status, 409);
      return true;
    });
  });

  test('JSON이 아닌 오류 응답은 HTTP_ERROR', async () => {
    const api = createGameApi({ baseUrl: 'http://api.test', fetchImpl: fakeFetch(502, undefined) });

    await assert.rejects(api.getGame('g1'), { code: 'HTTP_ERROR', status: 502 });
  });

  test('연결 실패는 NETWORK_ERROR', async () => {
    const api = createGameApi({
      baseUrl: 'http://api.test',
      fetchImpl: (async () => {
        throw new TypeError('Network request failed');
      }) as typeof fetch,
    });

    await assert.rejects(api.getGame('g1'), { code: 'NETWORK_ERROR' });
  });

  test('출시 빌드(requireHttps)에서는 http 주소로 요청하지 않는다', async () => {
    const calls: Call[] = [];
    const api = createGameApi({
      baseUrl: 'http://api.test',
      requireHttps: true,
      fetchImpl: fakeFetch(200, RAW_STATE, calls),
    });

    await assert.rejects(api.getGame('g1'), { code: 'CONFIG_ERROR' });
    assert.equal(calls.length, 0);

    const secure = createGameApi({
      baseUrl: 'https://api.test',
      requireHttps: true,
      fetchImpl: fakeFetch(200, RAW_STATE, calls),
    });
    await secure.getGame('g1');
    assert.equal(calls[0]?.url, 'https://api.test/v1/games/g1');
  });

  test('서버 주소가 없으면 요청하지 않고 CONFIG_ERROR', async () => {
    const calls: Call[] = [];
    const api = createGameApi({ baseUrl: undefined, fetchImpl: fakeFetch(200, RAW_STATE, calls) });

    await assert.rejects(api.getGame('g1'), { code: 'CONFIG_ERROR' });
    assert.equal(calls.length, 0);
  });
});
