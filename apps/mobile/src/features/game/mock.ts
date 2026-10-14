/**
 * 화면 확인용 임시 데이터
 *
 * ⚠️ 2주차에 게임 API(POST /v1/games, POST /v1/games/{id}/moves, GET /v1/games/{id}/result)로 교체한다.
 *
 * 진행 예시는 두음법칙이 두 번 나오도록 골랐다.
 *   실력 → (력→역) 역량 → 다음은 '량' 또는 '양'으로 시작
 * 뜻풀이는 화면 확인용으로 직접 쓴 짧은 설명이며, 실제 서비스에서는 사전 데이터의 뜻을 쓴다.
 */
import type { Difficulty, GameResult, GameState } from './types';

export const MOCK_BEST_SCORES: Record<Difficulty, number | null> = {
  easy: 820,
  normal: 1240,
  hard: null,
};

export const MOCK_GAME: GameState = {
  gameId: 'demo',
  difficulty: 'normal',
  status: 'playing',
  endReason: null,
  turn: 5,
  lives: 2,
  maxLives: 3,
  score: 160,
  allowedStarts: ['량', '양'],
  turnSeconds: 15,
  deadlineAt: 0, // 게임 화면이 열린 시각 기준으로 다시 잡는다
  lastWord: '역량',
  chain: [
    { turn: 1, speaker: 'player', word: '학교' },
    { turn: 2, speaker: 'ai', word: '교실' },
    { turn: 3, speaker: 'player', word: '실력' },
    { turn: 4, speaker: 'ai', word: '역량' },
  ],
};

export const MOCK_RESULT: GameResult = {
  gameId: 'demo',
  difficulty: 'normal',
  outcome: 'won',
  reason: 'ai_stuck',
  score: 1340,
  isNewBest: true,
  words: [
    { turn: 1, speaker: 'player', word: '학교', definition: '학생을 모아 가르치는 기관' },
    { turn: 2, speaker: 'ai', word: '교실', definition: '수업이 이루어지는 방' },
    { turn: 3, speaker: 'player', word: '실력', definition: '실제로 갖추고 있는 능력' },
    { turn: 4, speaker: 'ai', word: '역량', definition: '어떤 일을 해낼 수 있는 힘' },
    { turn: 5, speaker: 'player', word: '양말', definition: '발에 신는 천으로 된 물건' },
    { turn: 6, speaker: 'ai', word: '말벌', definition: '몸집이 큰 벌의 한 종류' },
    { turn: 7, speaker: 'player', word: '벌꿀', definition: '꿀벌이 모아 만든 꿀' },
  ],
};
