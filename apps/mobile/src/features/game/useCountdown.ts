import { useEffect, useState } from 'react';

/** 마감 시각까지 남은 초 (정수, 0 아래로 내려가지 않음). 순수 함수라 테스트하기 쉽다 */
export function secondsUntil(deadlineMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

/**
 * 턴 타이머 표시용 카운트다운.
 *
 * '1초마다 1씩 빼기'가 아니라 '마감 시각 - 현재 시각'으로 매번 다시 계산한다.
 * setInterval은 앱이 백그라운드로 가거나 JS 스레드가 바쁘면 밀리기 때문에,
 * 빼기 방식은 실제보다 시간이 느리게 흐르는 오차가 쌓인다.
 * 2주차에는 deadlineMs를 서버 응답의 deadline으로 받아 기기 간 오차도 없앤다(기획서 G-05).
 */
export function useCountdown(deadlineMs: number): number {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(deadlineMs));

  useEffect(() => {
    // 250ms 간격: 초 경계를 놓치지 않으면서 렌더링은 최소화
    const id = setInterval(() => {
      const next = secondsUntil(deadlineMs);
      setSecondsLeft(next);
      if (next === 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [deadlineMs]);

  return secondsLeft;
}
