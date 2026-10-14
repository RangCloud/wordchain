/**
 * 게임 API 클라이언트 (기획서 2-4)
 *
 * - 서버 응답(snake_case)을 앱 타입(camelCase)으로 바꾸는 일은 여기서만 한다. 화면은 서버 형식을 모른다.
 * - 규칙 위반(사전에 없는 단어 등)은 200 + verdict로 오고, 4xx/5xx·네트워크 오류만 ApiError로 던진다.
 * - fetch와 시계를 주입받는 이유: node:test로 실제 서버 없이 요청·변환을 검증하려고.
 *
 * import는 모두 `import type`이어야 한다: 타입만 쓰면 node:test가 빌드 없이 이 파일을 읽을 수 있다.
 */
import type {
  ChainWord,
  Difficulty,
  EndReason,
  GameResult,
  GameState,
  GameStatus,
  Verdict,
} from './types';

// ── 서버 응답 형식 ───────────────────────────────────────────────
interface RawMove {
  word: string;
  by: 'player' | 'ai';
}

export interface RawGameState {
  game_id: string;
  difficulty: Difficulty;
  status: GameStatus;
  end_reason: string | null;
  turn: number;
  lives: number;
  max_lives: number;
  turn_seconds: number;
  score: number;
  deadline: string;
  server_time: string;
  last_word: string | null;
  allowed_starts: string[];
  moves: RawMove[];
}

interface RawMoveResponse {
  verdict: Verdict;
  ai_word: string | null;
  game: RawGameState;
}

interface RawResult {
  game_id: string;
  difficulty: Difficulty;
  status: GameStatus;
  end_reason: string | null;
  score: number;
  words: (RawMove & { definition: string | null })[];
}

// ── 앱에 돌려주는 형식 ───────────────────────────────────────────
export interface MoveResult {
  verdict: Verdict;
  aiWord: string | null;
  game: GameState;
}

/** 최고 기록 여부(isNewBest)는 기기에 저장된 기록과 비교해야 하므로 화면 쪽에서 채운다 (G-08) */
export type ServerResult = Omit<GameResult, 'isNewBest'>;

/**
 * 서버 오류 코드(GAME_NOT_FOUND, TURN_MISMATCH 등) + 앱에서 만드는 코드.
 * NETWORK_ERROR: 연결 실패·응답 시간 초과, CONFIG_ERROR: 서버 주소 미설정
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

// ── 순수 변환 함수 (단위 테스트 대상) ────────────────────────────

/**
 * ISO 8601 시각 → epoch ms.
 * 서버(Python)는 소수점 아래 6자리(마이크로초)를 보내는데, ECMAScript 날짜 형식은 3자리까지만 보장한다.
 * 기기 JS 엔진(Hermes)마다 해석이 다를 수 있으므로 3자리로 잘라서 넘긴다.
 */
export function parseIsoMs(iso: string): number {
  const ms = Date.parse(iso.replace(/(\.\d{3})\d+/, '$1'));
  if (Number.isNaN(ms)) throw new ApiError('BAD_RESPONSE', '서버 응답을 읽을 수 없어요', 0);
  return ms;
}

function toEndReason(code: string | null): EndReason | null {
  return code === null ? null : (code.toLowerCase() as EndReason);
}

function toChain(moves: RawMove[]): ChainWord[] {
  return moves.map((m, i) => ({ turn: i + 1, speaker: m.by, word: m.word }));
}

/**
 * 마감 시각을 기기 시계 기준으로 옮긴다. 기기 시계가 서버와 몇 초 어긋나 있어도
 * '남은 시간'은 서버가 본 그대로가 되도록, 절대 시각이 아니라 남은 시간(deadline - server_time)을 쓴다.
 */
export function toGameState(raw: RawGameState, receivedAt: number): GameState {
  const remainingMs = parseIsoMs(raw.deadline) - parseIsoMs(raw.server_time);
  return {
    gameId: raw.game_id,
    difficulty: raw.difficulty,
    status: raw.status,
    endReason: toEndReason(raw.end_reason),
    turn: raw.turn,
    lives: raw.lives,
    maxLives: raw.max_lives,
    score: raw.score,
    allowedStarts: raw.allowed_starts,
    turnSeconds: raw.turn_seconds,
    deadlineAt: receivedAt + remainingMs,
    lastWord: raw.last_word,
    chain: toChain(raw.moves),
  };
}

export function toResult(raw: RawResult): ServerResult {
  return {
    gameId: raw.game_id,
    difficulty: raw.difficulty,
    // 결과는 끝난 게임만 조회되므로(진행 중이면 409) playing은 오지 않는다
    outcome: raw.status === 'won' ? 'won' : 'lost',
    reason: toEndReason(raw.end_reason) ?? 'forfeit',
    score: raw.score,
    words: raw.words.map((w, i) => ({
      turn: i + 1,
      speaker: w.by,
      word: w.word,
      definition: w.definition ?? '뜻풀이가 없어요',
    })),
  };
}

// ── HTTP ─────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 10_000;

interface Options {
  baseUrl: string | undefined;
  /** true면 https 주소만 허용한다. 출시 빌드에서 평문(http)으로 단어·게임 ID가 오가지 않게 한다 */
  requireHttps?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export function createGameApi({
  baseUrl,
  requireHttps = false,
  fetchImpl = fetch,
  now = Date.now,
}: Options) {
  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    if (!baseUrl) {
      throw new ApiError('CONFIG_ERROR', 'EXPO_PUBLIC_API_URL이 설정되지 않았어요', 0);
    }
    if (requireHttps && !baseUrl.startsWith('https://')) {
      throw new ApiError('CONFIG_ERROR', '출시 빌드의 서버 주소는 https여야 해요', 0);
    }
    // 응답이 오지 않으면 타이머가 끝날 때까지 '제출 중'에 갇히므로 일정 시간 뒤 끊는다
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/v1${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError('NETWORK_ERROR', '서버에 연결할 수 없어요', 0);
    } finally {
      clearTimeout(timer);
    }

    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      // 서버 공통 오류 형식: {"error": {"code", "message", "request_id"}}
      const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(
        error?.code ?? 'HTTP_ERROR',
        error?.message ?? '요청을 처리하지 못했어요',
        res.status,
      );
    }
    if (data === null) throw new ApiError('BAD_RESPONSE', '서버 응답을 읽을 수 없어요', res.status);
    return data as T;
  }

  return {
    async createGame(difficulty: Difficulty): Promise<GameState> {
      const raw = await request<RawGameState>('POST', '/games', { difficulty });
      return toGameState(raw, now());
    },
    async getGame(gameId: string): Promise<GameState> {
      const raw = await request<RawGameState>('GET', `/games/${encodeURIComponent(gameId)}`);
      return toGameState(raw, now());
    },
    async submitMove(gameId: string, turn: number, word: string): Promise<MoveResult> {
      const raw = await request<RawMoveResponse>(
        'POST',
        `/games/${encodeURIComponent(gameId)}/moves`,
        { turn, word: word.trim() },
      );
      return { verdict: raw.verdict, aiWord: raw.ai_word, game: toGameState(raw.game, now()) };
    },
    async forfeit(gameId: string): Promise<GameState> {
      const raw = await request<RawGameState>(
        'POST',
        `/games/${encodeURIComponent(gameId)}/forfeit`,
      );
      return toGameState(raw, now());
    },
    async getResult(gameId: string): Promise<ServerResult> {
      const raw = await request<RawResult>('GET', `/games/${encodeURIComponent(gameId)}/result`);
      return toResult(raw);
    },
  };
}

export type GameApi = ReturnType<typeof createGameApi>;

// Expo는 빌드할 때 `process.env.EXPO_PUBLIC_*`를 글자 그대로 찾아 값으로 바꾼다 → 구조 분해하면 안 된다
// 개발 중(Expo Go·로컬 서버)에는 http를 허용하고, 출시 빌드(__DEV__ === false)에서는 https만 쓴다.
// typeof 검사: node:test에는 __DEV__가 없다
export const gameApi = createGameApi({
  baseUrl: process.env.EXPO_PUBLIC_API_URL,
  requireHttps: typeof __DEV__ !== 'undefined' && !__DEV__,
});
