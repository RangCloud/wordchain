import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { gameApi } from './api';
import { errorMessage, TIMEOUT_SYNC_DELAY_MS, verdictMessage } from './logic';
import type { Difficulty, GameState } from './types';

type Start = { kind: 'new'; difficulty: Difficulty } | { kind: 'resume'; gameId: string };

interface Feedback {
  tone: 'danger';
  text: string;
}

/**
 * 게임 한 판의 서버 동기화 (G-01 ~ G-06)
 *
 * 서버 권위형: 판정·목숨·점수·마감 시각은 모두 서버 응답으로만 바꾼다. 앱이 직접 계산하지 않는다.
 * 서버와 다시 맞추는 시점:
 * - 마감 시각 + 허용치가 지났을 때 → 서버가 TIMEOUT으로 확정한다
 * - 앱이 백그라운드에서 돌아왔을 때 → 그동안 흐른 시간을 반영한다 (TC-W-18)
 * - TURN_MISMATCH를 받았을 때 → 앱이 들고 있는 턴이 낡았다는 뜻
 */
export function useGameSession(start: Start | null) {
  const [game, setGame] = useState<GameState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // 화면이 닫힌 뒤 도착한 응답으로 상태를 바꾸지 않도록 한다
  const alive = useRef(true);
  // 게임은 한 번만 만든다: 리렌더나 개발 모드의 effect 재실행으로 게임이 두 개 생기면 안 된다
  const started = useRef(false);

  const load = useCallback(async () => {
    if (!start) return;
    setLoadError(null);
    try {
      const next =
        start.kind === 'new'
          ? await gameApi.createGame(start.difficulty)
          : await gameApi.getGame(start.gameId);
      if (alive.current) setGame(next);
    } catch (e) {
      if (alive.current) setLoadError(errorMessage(e));
    }
  }, [start]);

  useEffect(() => {
    alive.current = true;
    if (!started.current) {
      started.current = true;
      void load();
    }
    return () => {
      alive.current = false;
    };
  }, [load]);

  const sync = useCallback(async (gameId: string) => {
    try {
      const next = await gameApi.getGame(gameId);
      if (alive.current) setGame(next);
    } catch (e) {
      if (alive.current) setFeedback({ tone: 'danger', text: errorMessage(e) });
    }
  }, []);

  const gameId = game?.gameId;
  const playing = game?.status === 'playing';
  const deadlineAt = game?.deadlineAt;

  // 마감이 지나면 서버에 물어 패배를 확정한다. 앱 시계만 보고 혼자 끝내지 않는다(서버 권위형)
  useEffect(() => {
    if (!gameId || !playing || deadlineAt === undefined) return;
    const wait = Math.max(0, deadlineAt - Date.now()) + TIMEOUT_SYNC_DELAY_MS;
    const id = setTimeout(() => void sync(gameId), wait);
    return () => clearTimeout(id);
  }, [gameId, playing, deadlineAt, sync]);

  useEffect(() => {
    if (!gameId || !playing) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync(gameId);
    });
    return () => sub.remove();
  }, [gameId, playing, sync]);

  const submit = useCallback(
    async (word: string) => {
      // 제출 중에는 다시 보내지 않는다 (G-02 중복 제출 방지)
      if (!game || submitting || game.status !== 'playing') return;
      setSubmitting(true);
      setFeedback(null);
      try {
        const res = await gameApi.submitMove(game.gameId, game.turn, word);
        if (!alive.current) return;
        setGame(res.game);
        if (res.verdict !== 'OK') {
          // 오류 문구의 시작 글자는 제출할 때 기준이어야 하므로 이전 상태의 글자를 쓴다
          setFeedback({ tone: 'danger', text: verdictMessage(res.verdict, game.allowedStarts) });
        }
      } catch (e) {
        if (!alive.current) return;
        const code = typeof e === 'object' && e !== null && 'code' in e ? e.code : null;
        if (code === 'TURN_MISMATCH' || code === 'GAME_ALREADY_ENDED') {
          await sync(game.gameId);
        } else {
          setFeedback({ tone: 'danger', text: errorMessage(e) });
        }
      } finally {
        if (alive.current) setSubmitting(false);
      }
    },
    [game, submitting, sync],
  );

  const forfeit = useCallback(async () => {
    if (!game) return;
    try {
      setGame(await gameApi.forfeit(game.gameId));
    } catch {
      // 이미 끝났거나(409) 연결이 끊겨도 결과 화면에서 서버 상태를 다시 읽으므로 그대로 진행한다
      await sync(game.gameId);
    }
  }, [game, sync]);

  return { game, loadError, retry: load, submitting, feedback, submit, forfeit };
}
