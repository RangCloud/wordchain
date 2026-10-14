/**
 * 한글 음절 분해·조합과 두음법칙 (서버 app/domain/hangul.py와 같은 규칙)
 *
 * 앱에서는 '시작 글자' 즉시 안내에만 쓴다. 최종 판정은 항상 서버가 한다.
 * 두 구현이 어긋나지 않도록 shared/hangul-vectors.json으로 서버와 같은 벡터를 검증한다.
 *
 * 다른 파일을 import하지 않는다: node:test가 이 파일을 빌드 없이 바로 읽을 수 있어야 한다.
 */

const HANGUL_BASE = 0xac00; // '가'
const HANGUL_LAST = 0xd7a3; // '힣'
const CHO_COUNT = 19;
const JUNG_COUNT = 21;
const JONG_COUNT = 28; // 받침 없음(0)을 포함한 개수

export function isHangulSyllable(ch: string): boolean {
  // length 대신 코드 포인트 수를 센다: 이모지 같은 서로게이트 쌍도 '한 글자'로 다뤄야 한다
  if ([...ch].length !== 1) return false;
  const code = ch.codePointAt(0) ?? -1;
  return code >= HANGUL_BASE && code <= HANGUL_LAST;
}

export function decompose(ch: string): [cho: number, jung: number, jong: number] {
  if (!isHangulSyllable(ch)) {
    throw new RangeError(`완성형 한글 음절이 아닙니다: ${JSON.stringify(ch)}`);
  }
  const code = ch.charCodeAt(0) - HANGUL_BASE;
  return [
    Math.floor(code / (JUNG_COUNT * JONG_COUNT)),
    Math.floor(code / JONG_COUNT) % JUNG_COUNT,
    code % JONG_COUNT,
  ];
}

export function compose(cho: number, jung: number, jong = 0): string {
  const inRange = (v: number, max: number) => Number.isInteger(v) && v >= 0 && v < max;
  if (!inRange(cho, CHO_COUNT) || !inRange(jung, JUNG_COUNT) || !inRange(jong, JONG_COUNT)) {
    throw new RangeError(`인덱스 범위를 벗어났습니다: ${cho}, ${jung}, ${jong}`);
  }
  return String.fromCharCode(HANGUL_BASE + (cho * JUNG_COUNT + jung) * JONG_COUNT + jong);
}

// ── 두음법칙 (한글 맞춤법 제10~12항, 단어 첫머리 규칙) ──────────────────
const CHO_N = 2; // ㄴ
const CHO_R = 5; // ㄹ
const CHO_O = 11; // ㅇ
const R_TO_O = new Set([2, 6, 7, 12, 17, 20]); // ㄹ + ㅑ ㅕ ㅖ ㅛ ㅠ ㅣ → ㅇ
const R_TO_N = new Set([0, 1, 8, 11, 13, 18]); // ㄹ + ㅏ ㅐ ㅗ ㅚ ㅜ ㅡ → ㄴ
const N_TO_O = new Set([6, 12, 17, 20]); // ㄴ + ㅕ ㅛ ㅠ ㅣ → ㅇ

/** 두음법칙을 적용한 글자. 대상이 아니면 그대로 돌려준다. 받침은 유지한다(력 → 역). */
export function dueum(ch: string): string {
  const [cho, jung, jong] = decompose(ch);
  if (cho === CHO_R && R_TO_O.has(jung)) return compose(CHO_O, jung, jong);
  if (cho === CHO_R && R_TO_N.has(jung)) return compose(CHO_N, jung, jong);
  if (cho === CHO_N && N_TO_O.has(jung)) return compose(CHO_O, jung, jong);
  return ch;
}

/**
 * 앞 단어의 끝 글자 뒤에 올 수 있는 시작 글자들. 원래 글자가 항상 맨 앞이다.
 * 화면의 원고지 칸이 [원래 글자, 두음 글자] 순서로 그려지므로 순서가 중요하다.
 */
export function allowedStarts(lastChar: string): string[] {
  const converted = dueum(lastChar);
  return converted === lastChar ? [lastChar] : [lastChar, converted];
}
