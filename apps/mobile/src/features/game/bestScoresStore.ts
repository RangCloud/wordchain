import AsyncStorage from '@react-native-async-storage/async-storage';

import { applyScore, type BestScores, parseRecord } from './bestScores';
import type { Difficulty } from './types';

/**
 * 최고 기록 저장 (G-08)
 *
 * AsyncStorage는 암호화되지 않는다. 그래서 점수와 마지막 게임 ID 외에는(개인정보·서버 주소 등)
 * 넣지 않는다. 키에 버전을 붙여 두면 형식을 바꿀 때 예전 값과 섞이지 않는다.
 */
const KEY = 'wordchain.best.v1';

export async function loadBestScores(): Promise<BestScores> {
  try {
    return parseRecord(await AsyncStorage.getItem(KEY)).scores;
  } catch {
    // 저장소를 못 읽어도 게임은 할 수 있어야 하므로 기록 없음으로 보여 준다
    return parseRecord(null).scores;
  }
}

/** 점수를 반영하고 최고 기록을 갱신했는지 돌려준다. 저장에 실패하면 갱신하지 않은 것으로 본다 */
export async function recordScore(
  gameId: string,
  difficulty: Difficulty,
  score: number,
): Promise<boolean> {
  try {
    const current = parseRecord(await AsyncStorage.getItem(KEY));
    const { record, isNewBest } = applyScore(current, gameId, difficulty, score);
    if (record !== current) await AsyncStorage.setItem(KEY, JSON.stringify(record));
    return isNewBest;
  } catch {
    return false;
  }
}
