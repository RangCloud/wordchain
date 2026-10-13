/** 기획서 2-4 API 명세의 응답 필드와 이름을 맞춘다 (서버 snake_case → 앱 camelCase 변환은 api 계층에서) */

export type Difficulty = 'easy' | 'normal' | 'hard';

export type Speaker = 'player' | 'ai';

export interface ChainWord {
  turn: number;
  speaker: Speaker;
  word: string;
}

export interface GameState {
  gameId: string;
  difficulty: Difficulty;
  turn: number;
  lives: number;
  maxLives: number;
  score: number;
  /** 다음 단어가 시작할 수 있는 글자들. 두음법칙이 적용되면 2개가 된다 (예: ['량', '양']) */
  allowedStarts: string[];
  /** 턴 제한 시간(초) */
  turnSeconds: number;
  chain: ChainWord[];
}

export interface ResultWord extends ChainWord {
  /** 결과 화면에서 펼쳐 보는 뜻풀이 */
  definition: string;
}

export interface GameResult {
  gameId: string;
  difficulty: Difficulty;
  outcome: 'won' | 'lost';
  reason: 'ai_stuck' | 'timeout' | 'no_lives' | 'forfeit';
  score: number;
  isNewBest: boolean;
  words: ResultWord[];
}

export interface DifficultyInfo {
  id: Difficulty;
  name: string;
  description: string;
  turnSeconds: number;
}

/** 기획서 2-3 'AI 수 선택 전략' 표와 같은 내용 */
export const DIFFICULTIES: readonly DifficultyInfo[] = [
  { id: 'easy', name: '쉬움', description: 'AI가 2~3글자 쉬운 단어만 써요', turnSeconds: 15 },
  { id: 'normal', name: '보통', description: 'AI가 사전 전체에서 골라요', turnSeconds: 15 },
  { id: 'hard', name: '어려움', description: '10초 제한 · 막히는 글자로 몰아요', turnSeconds: 10 },
];

export const REASON_LABELS: Record<GameResult['reason'], string> = {
  ai_stuck: 'AI가 이어갈 단어를 찾지 못했어요',
  timeout: '시간이 다 됐어요',
  no_lives: '목숨을 모두 잃었어요',
  forfeit: '게임을 그만뒀어요',
};
