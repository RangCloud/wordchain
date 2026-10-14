"""게임 세션 저장소 (메모리 TTL 캐시).

MVP는 서버 한 대로 돌리므로 메모리로 충분하다. 저장소를 클래스 하나로 감싸 두어,
나중에 서버를 여러 대로 늘릴 때 Redis 구현으로 바꿔 끼울 수 있게 한다.
"""

import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app.domain.ai_player import Difficulty

# 기획서 2-4: 생성 30분이 지난 게임은 없는 것으로 본다 (한 판 2~3분이므로 넉넉한 값)
SESSION_TTL = timedelta(minutes=30)


@dataclass
class Move:
    word: str
    by: str  # "player" | "ai"


@dataclass
class GameSession:
    game_id: str
    difficulty: Difficulty
    seed: int
    created_at: datetime
    deadline: datetime
    turn: int = 1
    lives: int = 3
    score: int = 0
    used_words: set[str] = field(default_factory=set)
    moves: list[Move] = field(default_factory=list)
    allowed_starts: list[str] = field(default_factory=list)
    status: str = "playing"  # playing | won | lost
    end_reason: str | None = None
    # 같은 게임에 요청이 동시에 들어와도 turn 검사와 갱신이 한 번에 일어나도록 잠근다 (TC-W-16)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False, compare=False)

    @property
    def last_word(self) -> str | None:
        return self.moves[-1].word if self.moves else None


class InMemoryGameRepo:
    def __init__(self, ttl: timedelta = SESSION_TTL) -> None:
        self._ttl = ttl
        self._sessions: dict[str, GameSession] = {}
        self._lock = threading.Lock()

    def save(self, session: GameSession) -> None:
        with self._lock:
            # 만료된 세션이 쌓여 메모리가 늘지 않도록 새 게임을 만들 때마다 정리한다
            self._purge(session.created_at)
            self._sessions[session.game_id] = session

    def get(self, game_id: str, now: datetime) -> GameSession | None:
        with self._lock:
            session = self._sessions.get(game_id)
            if session is None:
                return None
            if now - session.created_at > self._ttl:
                del self._sessions[game_id]
                return None
            return session

    def _purge(self, now: datetime) -> None:
        expired = [gid for gid, s in self._sessions.items() if now - s.created_at > self._ttl]
        for gid in expired:
            del self._sessions[gid]
