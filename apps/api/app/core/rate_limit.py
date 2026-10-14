"""IP당 요청 수 제한 (429 RATE_LIMITED, 기획서 2-4).

새 라이브러리 없이 메모리 슬라이딩 윈도로 구현한다. 서버 한 대 MVP에는 충분하고,
서버를 여러 대로 늘리면 Redis 같은 공유 저장소로 바꿔야 한다.

클라이언트 IP는 request.client.host를 쓴다. X-Forwarded-For를 직접 읽지 않는 이유:
누구나 헤더를 꾸며 제한을 피할 수 있다. 프록시 뒤에 둘 때는 uvicorn의
--proxy-headers --forwarded-allow-ips=<프록시 주소>로 믿을 수 있는 프록시만 허용한다.
"""

import math
import threading
import time
from collections import deque
from collections.abc import Callable


class SlidingWindowLimiter:
    def __init__(
        self, limit: int, window_seconds: float = 60.0, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self._limit = limit
        self._window = window_seconds
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._last_sweep = clock()

    def check(self, key: str) -> float | None:
        """요청을 받아도 되면 None, 아니면 다시 시도할 수 있을 때까지의 초."""
        now = self._clock()
        with self._lock:
            self._sweep(now)
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= now - self._window:
                hits.popleft()
            if len(hits) >= self._limit:
                return max(0.0, hits[0] + self._window - now)
            hits.append(now)
            return None

    def _sweep(self, now: float) -> None:
        # 한 번 오고 다시 오지 않는 IP가 계속 쌓이면 메모리가 늘어나므로, 윈도마다 빈 기록을 지운다
        if now - self._last_sweep < self._window:
            return
        self._last_sweep = now
        stale = [k for k, h in self._hits.items() if not h or h[-1] <= now - self._window]
        for key in stale:
            del self._hits[key]


def retry_after_header(seconds: float) -> str:
    # Retry-After는 정수 초. 0으로 내림하면 클라이언트가 곧바로 다시 보내므로 올림한다
    return str(max(1, math.ceil(seconds)))
