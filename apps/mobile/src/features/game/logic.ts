/**
 * 게임 화면의 계산·문구 (순수 함수 → node:test 대상)
 *
 * 화면은 이 함수들의 결과만 그린다. import는 타입만: node:test가 빌드 없이 읽어야 한다.
 */
import type { Difficulty, Verdict } from './types';

const DIFFICULTY_IDS: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/**
 * 라우트 파라미터 검증. URL(딥링크)은 누구나 만들 수 있으므로 받은 값을 그대로 서버에 넘기지 않는다.
 */
export function parseDifficulty(value: unknown): Difficulty | null {
  return DIFFICULTY_IDS.find((d) => d === value) ?? null;
}

/** 서버가 만드는 게임 ID 형식(uuid4 hex 32자)만 받는다 */
export function isValidGameId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);
}

/** 서버 판정 전에 화면에서 바로 알려 줄 '시작 글자' 검사. 첫 턴(허용 글자 없음)은 통과 */
export function startsCorrectly(word: string, allowedStarts: readonly string[]): boolean {
  return allowedStarts.length === 0 || allowedStarts.includes(word.charAt(0));
}

export function startsLabel(allowedStarts: readonly string[]): string {
  return allowedStarts.map((c) => `'${c}'`).join(' 또는 ');
}

/** 기획서 2-3 '판정 결과 코드' 표의 사용자 메시지 */
export function verdictMessage(verdict: Verdict, allowedStarts: readonly string[]): string {
  switch (verdict) {
    case 'OK':
      return '';
    case 'TIMEOUT':
      return '시간 초과!';
    case 'INVALID_CHARS':
      return '한글 단어만 입력할 수 있어요';
    case 'TOO_SHORT':
      return '2글자 이상 입력해 주세요';
    case 'WRONG_START':
      return `${startsLabel(allowedStarts)}(으)로 시작해야 해요`;
    case 'ALREADY_USED':
      return '이미 나온 단어예요';
    case 'NOT_IN_DICT':
      return '사전에 없는 단어예요';
    case 'HANBANG_FIRST_TURN':
      return '첫 턴에는 한방단어를 쓸 수 없어요';
  }
}

/**
 * 오류를 사용자 문구로. 서버가 준 message를 그대로 보여 주지 않고 code로만 고른다:
 * 서버 문구가 바뀌거나 예상 밖의 내용이 와도 화면에는 앱이 정한 문장만 나간다.
 */
export function errorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'NETWORK_ERROR':
      return '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.';
    case 'RATE_LIMITED':
      return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
    case 'SERVER_BUSY':
      return '지금은 사람이 많아요. 잠시 후 다시 시도해 주세요.';
    case 'GAME_NOT_FOUND':
      return '게임을 찾을 수 없어요. 30분이 지나면 게임이 사라져요.';
    case 'GAME_IN_PROGRESS':
      return '아직 진행 중인 게임이에요.';
    case 'CONFIG_ERROR':
      return '서버 주소가 설정되지 않았어요. (.env의 EXPO_PUBLIC_API_URL)';
    default:
      return '문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
  }
}

/** 마감 시각이 지난 뒤 서버에 결과를 물어볼 때까지 기다릴 시간(ms). 서버 허용치 1초 + 여유 */
export const TIMEOUT_SYNC_DELAY_MS = 1_500;
