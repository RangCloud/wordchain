/**
 * 기기 안에서 도는 게임 진행 (서버 app/services/game_service.py를 옮긴 것, G-01 · G-03~G-07)
 *
 * 앱 단독 출시: 서버 API 클라이언트(api.ts)와 같은 함수 이름·반환 타입을 지켜서
 * 화면과 useGameSession은 어느 쪽을 쓰는지 몰라도 된다. 나중에 랭킹용 서버를 붙일 때 다시 바꿔 끼운다.
 * 시계·사전·난수를 주입받는 이유: 마감 경계값과 AI 응답을 테스트에서 그대로 재현하려고.
 */
import { allowedStarts } from '../../lib/hangul.ts';
import { chooseWord, type Dictionary, GRACE_MS, judge, seededRng } from './engine.ts';
import type {
  ChainWord,
  Difficulty,
  EndReason,
  GameResult,
  GameState,
  GameStatus,
  Verdict,
} from './types';

export const START_LIVES = 3;
// 점수: 받아들여진 단어마다 '글자 수 × 10점', 승리 시 100점, 모두 난이도 배율을 곱한다 (G-06)
// 기본 점수가 10의 배수라 배율을 곱해도 항상 정수다
const POINTS_PER_CHAR = 10;
const WIN_POINTS = 100;
const SCORE_MULTIPLIER: Record<Difficulty, number> = { easy: 1.0, normal: 1.5, hard: 2.0 };
const TURN_SECONDS: Record<Difficulty, number> = { easy: 15, normal: 15, hard: 10 };
/** 오래된 판은 지운다. 한 판이 2~3분이므로 30분이면 넉넉하다 */
const SESSION_TTL_MS = 30 * 60 * 1000;

export interface MoveResult {
  verdict: Verdict;
  aiWord: string | null;
  game: GameState;
}

/** 최고 기록 여부(isNewBest)는 기기에 저장된 기록과 비교해야 하므로 화면 쪽에서 채운다 (G-08) */
export type LocalResult = Omit<GameResult, 'isNewBest'>;

/** 화면의 errorMessage()는 code만 보고 문구를 고른다 (서버 오류 코드와 같은 이름) */
export class GameError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}

interface Session {
  gameId: string;
  difficulty: Difficulty;
  seed: number;
  createdAt: number;
  deadline: number;
  turn: number;
  lives: number;
  score: number;
  used: Set<string>;
  chain: ChainWord[];
  allowedStarts: string[];
  status: GameStatus;
  endReason: EndReason | null;
}

interface Options {
  /** 처음 게임을 만들 때 한 번만 부른다: 21만 단어를 앱 시작 시점에 읽지 않으려고 */
  loadDictionary: () => Dictionary;
  now?: () => number;
  /** 0 이상 1 미만 난수. 게임 ID와 시드를 만든다 */
  random?: () => number;
}

export function createLocalGame({ loadDictionary, now = Date.now, random = Math.random }: Options) {
  const sessions = new Map<string, Session>();
  let dictionary: Dictionary | null = null;
  const dict = () => (dictionary ??= loadDictionary());

  function newGameId(): string {
    // 화면의 isValidGameId가 받는 형식(16진수 32자)에 맞춘다. 보안 용도가 아니므로 Math.random이면 충분하다
    let id = '';
    while (id.length < 32) id += Math.floor(random() * 16).toString(16);
    return id;
  }

  function get(gameId: string): Session {
    const session = sessions.get(gameId);
    if (session && now() - session.createdAt > SESSION_TTL_MS) sessions.delete(gameId);
    else if (session) return session;
    throw new GameError('GAME_NOT_FOUND', '게임을 찾을 수 없습니다.');
  }

  function isOverdue(s: Session, at: number): boolean {
    // judge와 같은 허용치를 써야 조회와 제출의 판단이 어긋나지 않는다
    return at > s.deadline + GRACE_MS;
  }

  function end(s: Session, status: GameStatus, reason: EndReason): void {
    s.status = status;
    s.endReason = reason;
  }

  function points(difficulty: Difficulty, base: number): number {
    return Math.round(base * SCORE_MULTIPLIER[difficulty]);
  }

  function record(s: Session, word: string, speaker: ChainWord['speaker']): void {
    s.chain.push({ turn: s.chain.length + 1, speaker, word });
    s.used.add(word);
  }

  /** 화면에 넘기는 값은 복사본이다: 화면이 실수로 바꿔도 진행 중인 판에 영향이 없다 */
  function toState(s: Session): GameState {
    return {
      gameId: s.gameId,
      difficulty: s.difficulty,
      status: s.status,
      endReason: s.endReason,
      turn: s.turn,
      lives: s.lives,
      maxLives: START_LIVES,
      score: s.score,
      allowedStarts: [...s.allowedStarts],
      turnSeconds: TURN_SECONDS[s.difficulty],
      deadlineAt: s.deadline,
      lastWord: s.chain.at(-1)?.word ?? null,
      chain: s.chain.map((w) => ({ ...w })),
    };
  }

  /** 백그라운드에 있다가 돌아왔을 때 등, 마감이 지났으면 여기서 패배로 확정한다 */
  function settle(gameId: string): Session {
    const s = get(gameId);
    if (s.status === 'playing' && isOverdue(s, now())) end(s, 'lost', 'timeout');
    return s;
  }

  function createGame(difficulty: Difficulty): GameState {
    const at = now();
    for (const [id, s] of sessions) if (at - s.createdAt > SESSION_TTL_MS) sessions.delete(id);
    dict(); // 사전을 먼저 읽어 둔다: 첫 제출 때 읽으면 그 시간만큼 플레이어의 제한 시간이 줄어든다
    const createdAt = now();
    const session: Session = {
      gameId: newGameId(),
      difficulty,
      seed: Math.floor(random() * 2 ** 32),
      createdAt,
      deadline: createdAt + TURN_SECONDS[difficulty] * 1000,
      turn: 1,
      lives: START_LIVES,
      score: 0,
      used: new Set(),
      chain: [],
      allowedStarts: [],
      status: 'playing',
      endReason: null,
    };
    sessions.set(session.gameId, session);
    return toState(session);
  }

  function submitMove(gameId: string, turn: number, rawWord: string): MoveResult {
    const at = now();
    const s = get(gameId);
    if (s.status !== 'playing') throw new GameError('GAME_ALREADY_ENDED', '이미 끝난 게임입니다.');
    if (turn !== s.turn) throw new GameError('TURN_MISMATCH', '이미 처리된 요청입니다.');
    // 무효 제출도 턴을 소비한다: 같은 제출이 두 번 들어와도 목숨이 두 번 깎이지 않는다
    s.turn += 1;

    const word = rawWord.trim(); // judge는 공백을 다루지 않는다
    const verdict = judge(word, {
      previousWord: s.chain.at(-1)?.word ?? null,
      used: s.used,
      dictionary: dict(),
      isFirstTurn: s.chain.length === 0,
      now: at,
      deadline: s.deadline,
    });

    if (verdict === 'TIMEOUT') {
      end(s, 'lost', 'timeout');
      return { verdict, aiWord: null, game: toState(s) };
    }
    if (verdict !== 'OK') {
      // 마감 시각은 그대로 둔다: 다시 입력하는 동안에도 시간은 흐른다 (규칙 6)
      s.lives -= 1;
      if (s.lives === 0) end(s, 'lost', 'no_lives');
      return { verdict, aiWord: null, game: toState(s) };
    }

    record(s, word, 'player');
    s.score += points(s.difficulty, POINTS_PER_CHAR * word.length);
    const aiWord = chooseWord({
      previousWord: word,
      used: s.used,
      dictionary: dict(),
      difficulty: s.difficulty,
      // 시드와 턴으로 매번 새 난수를 만든다: 같은 판·같은 턴이면 항상 같은 수
      rng: seededRng((s.seed ^ Math.imul(s.turn, 0x9e3779b1)) >>> 0),
      isFirstTurn: !s.chain.some((w) => w.speaker === 'ai'),
    });
    if (aiWord === null) {
      end(s, 'won', 'ai_stuck');
      s.score += points(s.difficulty, WIN_POINTS);
      return { verdict, aiWord: null, game: toState(s) };
    }

    record(s, aiWord, 'ai');
    s.allowedStarts = allowedStarts(aiWord.slice(-1));
    // AI가 고르는 데 쓴 시간을 플레이어 시간에서 빼지 않도록, 마감은 AI가 낸 뒤 시각 기준으로 잡는다
    s.deadline = now() + TURN_SECONDS[s.difficulty] * 1000;
    return { verdict, aiWord, game: toState(s) };
  }

  function forfeit(gameId: string): GameState {
    const s = get(gameId);
    if (s.status !== 'playing') throw new GameError('GAME_ALREADY_ENDED', '이미 끝난 게임입니다.');
    // 마감이 이미 지났다면 패배 원인은 기권이 아니라 시간 초과다 (G-06)
    end(s, 'lost', isOverdue(s, now()) ? 'timeout' : 'forfeit');
    return toState(s);
  }

  function getResult(gameId: string): LocalResult {
    const s = settle(gameId);
    if (s.status === 'playing') {
      throw new GameError('GAME_IN_PROGRESS', '아직 진행 중인 게임입니다.');
    }
    return {
      gameId: s.gameId,
      difficulty: s.difficulty,
      outcome: s.status === 'won' ? 'won' : 'lost',
      reason: s.endReason ?? 'forfeit',
      score: s.score,
      // 뜻풀이는 앱 용량 때문에 넣지 않았다(결정 A안). 결과 화면은 빈 문자열이면 펼치기를 숨긴다
      words: s.chain.map((w) => ({ ...w, definition: '' })),
    };
  }

  // 화면 코드가 서버 클라이언트와 똑같이 await로 부를 수 있게 Promise로 감싼다.
  // async 함수 안에서 던진 GameError는 거부된 Promise가 되어 기존 try/catch가 그대로 받는다
  return {
    createGame: async (difficulty: Difficulty) => createGame(difficulty),
    getGame: async (gameId: string) => toState(settle(gameId)),
    submitMove: async (gameId: string, turn: number, word: string) =>
      submitMove(gameId, turn, word),
    forfeit: async (gameId: string) => forfeit(gameId),
    getResult: async (gameId: string) => getResult(gameId),
  };
}

export type LocalGame = ReturnType<typeof createLocalGame>;
