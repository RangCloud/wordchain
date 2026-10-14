/**
 * 난이도별 최고 기록 계산 (G-08) — 순수 함수, node:test 대상
 *
 * 저장은 bestScoresStore.ts가 한다. 기기 저장소의 값은 앱 업데이트·직접 조작 등으로
 * 깨져 있을 수 있으므로, 읽을 때마다 형식을 검사하고 이상하면 기록 없음으로 본다.
 */
import type { Difficulty } from './types';

export type BestScores = Record<Difficulty, number | null>;

export interface BestRecord {
  scores: BestScores;
  /** 마지막으로 반영한 게임. 결과 화면을 다시 열어도 같은 판을 두 번 반영하지 않기 위해 둔다 */
  lastGame: { gameId: string; isNewBest: boolean } | null;
}

export const EMPTY_RECORD: BestRecord = {
  scores: { easy: null, normal: null, hard: null },
  lastGame: null,
};

// 서버 점수 체계로 나올 수 없는 큰 값은 조작된 것으로 보고 버린다
const MAX_SCORE = 1_000_000;

function validScore(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_SCORE ? v : null;
}

export function parseRecord(raw: string | null): BestRecord {
  if (raw === null) return EMPTY_RECORD;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return EMPTY_RECORD;
    const { scores, lastGame } = data as { scores?: Record<string, unknown>; lastGame?: unknown };
    const last =
      typeof lastGame === 'object' &&
      lastGame !== null &&
      typeof (lastGame as { gameId?: unknown }).gameId === 'string' &&
      typeof (lastGame as { isNewBest?: unknown }).isNewBest === 'boolean'
        ? (lastGame as { gameId: string; isNewBest: boolean })
        : null;
    return {
      scores: {
        easy: validScore(scores?.easy),
        normal: validScore(scores?.normal),
        hard: validScore(scores?.hard),
      },
      lastGame: last,
    };
  } catch {
    return EMPTY_RECORD;
  }
}

/** 한 판의 점수를 반영한다. 0점은 기록으로 치지 않는다(아무 단어도 못 낸 판) */
export function applyScore(
  record: BestRecord,
  gameId: string,
  difficulty: Difficulty,
  score: number,
): { record: BestRecord; isNewBest: boolean } {
  if (record.lastGame?.gameId === gameId) {
    return { record, isNewBest: record.lastGame.isNewBest };
  }
  const prev = record.scores[difficulty];
  const isNewBest = score > 0 && (prev === null || score > prev);
  return {
    record: {
      scores: isNewBest ? { ...record.scores, [difficulty]: score } : record.scores,
      lastGame: { gameId, isNewBest },
    },
    isNewBest,
  };
}
