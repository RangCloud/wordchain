/**
 * 끝말잇기 규칙 엔진과 AI (서버 app/domain의 rule_engine.py · ai_player.py · dictionary.py를 옮긴 것)
 *
 * 앱 단독 출시(서버 없음)를 위해 판정과 AI 수를 기기에서 계산한다.
 * React·저장소를 모르는 순수 함수라 node:test로 서버 테스트와 같은 케이스를 검증한다.
 * import에 .ts 확장자를 붙이는 이유: node:test가 빌드 없이 이 파일을 읽어야 한다.
 */
import { allowedStarts, isHangulSyllable } from '../../lib/hangul.ts';
import type { Difficulty, Verdict } from './types';

// ── 사전 ─────────────────────────────────────────────────────────

/** 규칙 엔진과 AI가 사전에 묻는 질문. 실제 단어 목록이든 테스트용 작은 사전이든 바꿔 끼울 수 있다 */
export interface Dictionary {
  contains(word: string): boolean;
  countStartingWith(firstChar: string): number;
  /** 반드시 가나다순: 시드를 고정했을 때 AI 결과가 재현되어야 한다 */
  wordsStartingWith(firstChar: string): readonly string[];
}

const EMPTY: readonly string[] = [];

export class WordList implements Dictionary {
  private readonly words: Set<string>;
  private readonly byFirst = new Map<string, string[]>();

  /** 2글자 이상 단어만 받는다(게임 규칙 1). 넣는 순서와 상관없이 가나다순으로 정리한다 */
  constructor(words: Iterable<string>) {
    const list = [...words].filter((w) => w.length >= 2);
    // 내보낸 단어 목록은 이미 정렬되어 있다. 21만 개를 기기에서 다시 정렬하지 않도록 필요할 때만 정렬한다.
    // 기본 sort는 UTF-16 코드 단위 순서 = 한글 음절에서는 서버(Python sorted·SQLite)와 같은 순서
    if (list.some((w, i) => i > 0 && (list[i - 1] as string) >= w)) list.sort();
    this.words = new Set(list);
    for (const word of this.words) {
      const first = word.charAt(0);
      const list = this.byFirst.get(first);
      if (list) list.push(word);
      else this.byFirst.set(first, [word]);
    }
  }

  contains(word: string): boolean {
    return this.words.has(word);
  }

  countStartingWith(firstChar: string): number {
    return this.byFirst.get(firstChar)?.length ?? 0;
  }

  wordsStartingWith(firstChar: string): readonly string[] {
    return this.byFirst.get(firstChar) ?? EMPTY;
  }
}

// ── 판정 (G-03) ──────────────────────────────────────────────────

/** 앱이 다른 일(렌더링 등)로 잠깐 멈춰 억울하게 지는 일을 막는 허용치 (G-05) */
export const GRACE_MS = 1_000;

/** 이 글자로 끝난 단어 뒤에 이어갈 수 있는 단어 수(두음법칙 포함). 0이면 한방 글자 */
export function nextCount(dictionary: Dictionary, lastChar: string): number {
  return allowedStarts(lastChar).reduce((sum, ch) => sum + dictionary.countStartingWith(ch), 0);
}

interface JudgeInput {
  previousWord: string | null;
  used: ReadonlySet<string>;
  dictionary: Dictionary;
  isFirstTurn: boolean;
  now: number;
  deadline: number;
}

/**
 * 제출된 단어를 판정한다. 가벼운 검사 → 사전 조회 순서가 고정되어 있어야 같은 입력에 같은 결과가 나온다.
 * 시각을 인자로 받는 이유: 엔진이 시계를 직접 보면 '마감 1.5초 후' 같은 경계값을 테스트할 수 없다.
 */
export function judge(word: string, input: JudgeInput): Verdict {
  const { previousWord, used, dictionary, isFirstTurn, now, deadline } = input;
  if (now > deadline + GRACE_MS) return 'TIMEOUT';
  if (!word || ![...word].every(isHangulSyllable)) return 'INVALID_CHARS';
  if (word.length < 2) return 'TOO_SHORT';
  if (previousWord !== null && !allowedStarts(previousWord.slice(-1)).includes(word.charAt(0))) {
    return 'WRONG_START';
  }
  if (used.has(word)) return 'ALREADY_USED';
  if (!dictionary.contains(word)) return 'NOT_IN_DICT';
  if (isFirstTurn && nextCount(dictionary, word.slice(-1)) === 0) return 'HANBANG_FIRST_TURN';
  return 'OK';
}

// ── AI (G-04) ────────────────────────────────────────────────────

export type Rng = () => number;

/**
 * 시드 고정 난수(mulberry32). Math.random은 시드를 줄 수 없어 같은 판을 재현할 수 없다.
 * 서버(Python random)와 같은 수열은 아니다 — 같은 시드면 '앱 안에서' 항상 같은 결과면 충분하다.
 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], rng: Rng): T {
  // 호출하는 쪽에서 빈 배열을 걸러 내므로 항상 값이 있다
  return items[Math.floor(rng() * items.length)] as T;
}

const EASY_MAX_LENGTH = 3;
const EASY_TOP_RATIO = 0.3;

interface ChooseInput {
  previousWord: string;
  used: ReadonlySet<string>;
  dictionary: Dictionary;
  difficulty: Difficulty;
  rng: Rng;
  isFirstTurn?: boolean;
}

/** AI가 낼 단어. 낼 단어가 없으면 null(= 플레이어 승리) */
export function chooseWord(input: ChooseInput): string | null {
  const { previousWord, used, dictionary, difficulty, rng, isFirstTurn = false } = input;
  let candidates: string[] = [];
  for (const start of allowedStarts(previousWord.slice(-1))) {
    for (const w of dictionary.wordsStartingWith(start)) if (!used.has(w)) candidates.push(w);
  }

  // 단어별 '상대가 이어갈 수 있는 단어 수'. 0이면 한방단어다
  const counts = new Map(candidates.map((w) => [w, nextCount(dictionary, w.slice(-1))]));
  const count = (w: string) => counts.get(w) ?? 0;

  // 한방단어는 어려움 난이도에서만, 그것도 첫 턴이 아닐 때만 쓴다
  if (difficulty !== 'hard' || isFirstTurn) candidates = candidates.filter((w) => count(w) > 0);
  if (difficulty === 'easy') candidates = candidates.filter((w) => w.length <= EASY_MAX_LENGTH);
  if (candidates.length === 0) return null;

  if (difficulty === 'normal') return pick(candidates, rng);

  if (difficulty === 'hard') {
    // 상대가 가장 잇기 어려운 끝 글자를 고른다. 동률이면 그 안에서 무작위
    // Math.min(...배열)은 후보가 수천 개일 때 인자 개수 한도에 걸릴 수 있어 reduce로 센다
    const fewest = candidates.reduce((min, w) => Math.min(min, count(w)), Infinity);
    return pick(
      candidates.filter((w) => count(w) === fewest),
      rng,
    );
  }

  // 쉬움: 상대가 잇기 쉬운 순으로 줄 세워 상위 30% 안에서 고른다.
  // Array.prototype.sort는 안정 정렬이라 동률은 가나다순을 유지한다 → 결과가 재현된다
  const ranked = [...candidates].sort((a, b) => count(b) - count(a));
  return pick(ranked.slice(0, Math.max(1, Math.ceil(ranked.length * EASY_TOP_RATIO))), rng);
}
