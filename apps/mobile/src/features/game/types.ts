/** 기획서 2-4 API 명세의 응답 필드와 이름을 맞춘다 (서버 snake_case → 앱 camelCase 변환은 api 계층에서) */

export type Difficulty = 'easy' | 'normal' | 'hard';

export type Speaker = 'player' | 'ai';

export type GameStatus = 'playing' | 'won' | 'lost';

/** 서버 종료 사유 코드(TIMEOUT 등)를 소문자로 바꾼 값 */
export type EndReason = 'ai_stuck' | 'timeout' | 'no_lives' | 'forfeit';

/** 서버 판정 결과 코드 (기획서 2-3 '판정 결과 코드와 판정 순서') */
export type Verdict =
  | 'OK'
  | 'TIMEOUT'
  | 'INVALID_CHARS'
  | 'TOO_SHORT'
  | 'WRONG_START'
  | 'ALREADY_USED'
  | 'NOT_IN_DICT'
  | 'HANBANG_FIRST_TURN';

export interface ChainWord {
  turn: number;
  speaker: Speaker;
  word: string;
}

export interface GameState {
  gameId: string;
  difficulty: Difficulty;
  status: GameStatus;
  endReason: EndReason | null;
  /** 다음 제출에 실어 보낼 턴 번호. 무효 제출도 1씩 올라간다(중복 제출 방지) */
  turn: number;
  lives: number;
  maxLives: number;
  score: number;
  /** 다음 단어가 시작할 수 있는 글자들. 두음법칙이 적용되면 2개가 된다 (예: ['량', '양']) */
  allowedStarts: string[];
  /** 턴 제한 시간(초) */
  turnSeconds: number;
  /** 현재 턴 마감 시각(기기 시계 기준 ms). 서버 시각과의 차이를 보정한 값이다 */
  deadlineAt: number;
  /** 다음 단어가 이어야 할 앞 단어. 첫 턴이면 null(아무 글자로나 시작 가능) */
  lastWord: string | null;
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
  reason: EndReason;
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

export const REASON_LABELS: Record<EndReason, string> = {
  ai_stuck: 'AI가 이어갈 단어를 찾지 못했어요',
  timeout: '시간이 다 됐어요',
  no_lives: '목숨을 모두 잃었어요',
  forfeit: '게임을 그만뒀어요',
};
