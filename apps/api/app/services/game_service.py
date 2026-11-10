"""게임 진행 (G-01, G-03~G-07).

규칙 판정과 AI 수는 domain에 맡기고, 여기서는 세션 상태(턴·목숨·마감 시각·점수)만 바꾼다.
시계(clock)를 밖에서 받는 이유: '마감 1.5초 후 제출' 같은 경계값을 테스트에서 그대로 재현하려면
서버 시각을 마음대로 정할 수 있어야 한다.
"""

import random
import secrets
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

from app.core.errors import AppError
from app.domain.ai_player import Difficulty, choose_word
from app.domain.dictionary import Dictionary
from app.domain.hangul import allowed_starts
from app.domain.rule_engine import GRACE_SECONDS, Verdict, judge
from app.repositories.game_repo import GameSession, InMemoryGameRepo, Move

Clock = Callable[[], datetime]

START_LIVES = 3
# 점수: 받아들여진 단어마다 '글자 수 × 10점', 승리하면 100점을 더 얹고 모두 난이도 배율을 곱한다.
# 긴 단어일수록 잇기 어렵고 생각할 시간이 들므로 글자 수에 비례시킨다.
# 기본 점수가 10의 배수라 배율(1.0/1.5/2.0)을 곱해도 항상 정수가 된다 → 반올림 오차가 없다
POINTS_PER_CHAR = 10
WIN_POINTS = 100
SCORE_MULTIPLIER = {Difficulty.EASY: 1.0, Difficulty.NORMAL: 1.5, Difficulty.HARD: 2.0}
TURN_SECONDS = {Difficulty.EASY: 15, Difficulty.NORMAL: 15, Difficulty.HARD: 10}

# 종료 사유. 사용자에게 보여 줄 문장은 앱이 정한다(서버는 코드만 준다)
END_TIMEOUT = "TIMEOUT"
END_NO_LIVES = "NO_LIVES"
END_AI_STUCK = "AI_STUCK"
END_FORFEIT = "FORFEIT"


class WordBook(Dictionary, Protocol):
    """결과 화면용 뜻풀이까지 주는 사전. 규칙 엔진은 뜻을 몰라도 되므로 domain 밖에 둔다."""

    def definition(self, word: str) -> str | None: ...


@dataclass(frozen=True)
class MoveOutcome:
    verdict: Verdict
    ai_word: str | None
    session: GameSession


class GameService:
    def __init__(self, *, repo: InMemoryGameRepo, dictionary: WordBook, clock: Clock) -> None:
        self._repo = repo
        self._dictionary = dictionary
        self._clock = clock

    def create(self, difficulty: Difficulty) -> GameSession:
        now = self._clock()
        session = GameSession(
            game_id=uuid.uuid4().hex,
            difficulty=difficulty,
            seed=secrets.randbits(32),
            created_at=now,
            deadline=now + _turn_limit(difficulty),
            lives=START_LIVES,
        )
        if not self._repo.save(session):
            # 메모리 보호: 세션이 상한에 닿으면 새 게임을 받지 않는다. 기존 게임은 계속 진행된다
            raise AppError("SERVER_BUSY", "지금은 사람이 많아요. 잠시 후 다시 시도해 주세요.", 503)
        return session

    def get_state(self, game_id: str) -> GameSession:
        now = self._clock()
        session = self._get(game_id, now)
        with session.lock:
            # 앱이 백그라운드에 있다가 돌아와 동기화할 때, 마감이 지났다면 여기서 패배로 확정한다
            if session.status == "playing" and _is_overdue(session, now):
                _end(session, "lost", END_TIMEOUT)
        return session

    def submit_move(self, game_id: str, turn: int, word: str) -> MoveOutcome:
        now = self._clock()
        session = self._get(game_id, now)
        with session.lock:
            if session.status != "playing":
                raise AppError("GAME_ALREADY_ENDED", "이미 끝난 게임입니다.", 409)
            if turn != session.turn:
                raise AppError("TURN_MISMATCH", "이미 처리된 요청입니다.", 409)
            # 무효 제출도 턴을 소비한다. 그래야 재전송된 같은 요청이 목숨을 두 번 깎지 않는다
            session.turn += 1

            word = word.strip()  # judge는 공백을 다루지 않는다(앞뒤 공백 제거는 서비스 책임)
            verdict = judge(
                word,
                previous_word=session.last_word,
                used=session.used_words,
                dictionary=self._dictionary,
                is_first_turn=not session.moves,
                now=now.timestamp(),
                deadline=session.deadline.timestamp(),
            )

            if verdict is Verdict.TIMEOUT:
                _end(session, "lost", END_TIMEOUT)
                return MoveOutcome(verdict, None, session)
            if verdict is not Verdict.OK:
                # 마감 시각은 그대로 둔다: 다시 입력하는 동안에도 시간은 흐른다 (규칙 6)
                session.lives -= 1
                if session.lives == 0:
                    _end(session, "lost", END_NO_LIVES)
                return MoveOutcome(verdict, None, session)

            _record(session, word, "player")
            session.score += _points(session.difficulty, POINTS_PER_CHAR * len(word))
            ai_word = choose_word(
                previous_word=word,
                used=session.used_words,
                dictionary=self._dictionary,
                difficulty=session.difficulty,
                # 시드와 턴으로 매번 새 rng를 만든다: 세션에 rng 객체를 들고 있지 않아도 재현된다
                rng=random.Random(session.seed * 10_000 + session.turn),
                is_first_turn=not any(m.by == "ai" for m in session.moves),
            )
            if ai_word is None:
                _end(session, "won", END_AI_STUCK)
                session.score += _points(session.difficulty, WIN_POINTS)
                return MoveOutcome(verdict, None, session)

            _record(session, ai_word, "ai")
            session.allowed_starts = list(allowed_starts(ai_word[-1]))
            session.deadline = now + _turn_limit(session.difficulty)
            return MoveOutcome(verdict, ai_word, session)

    def forfeit(self, game_id: str) -> GameSession:
        now = self._clock()
        session = self._get(game_id, now)
        with session.lock:
            if session.status != "playing":
                raise AppError("GAME_ALREADY_ENDED", "이미 끝난 게임입니다.", 409)
            # 마감이 이미 지났다면 패배 원인은 기권이 아니라 시간 초과다 (G-06: 패배 원인 표시)
            _end(session, "lost", END_TIMEOUT if _is_overdue(session, now) else END_FORFEIT)
        return session

    def get_result(self, game_id: str) -> tuple[GameSession, list[tuple[Move, str | None]]]:
        session = self.get_state(game_id)  # 마감이 지난 게임은 여기서 패배로 확정된다
        if session.status == "playing":
            raise AppError("GAME_IN_PROGRESS", "아직 진행 중인 게임입니다.", 409)
        return session, [(m, self._dictionary.definition(m.word)) for m in session.moves]

    def _get(self, game_id: str, now: datetime) -> GameSession:
        session = self._repo.get(game_id, now)
        if session is None:
            raise AppError("GAME_NOT_FOUND", "게임을 찾을 수 없습니다.", 404)
        return session


def _turn_limit(difficulty: Difficulty) -> timedelta:
    return timedelta(seconds=TURN_SECONDS[difficulty])


def _points(difficulty: Difficulty, base: int) -> int:
    return int(base * SCORE_MULTIPLIER[difficulty])


def _is_overdue(session: GameSession, now: datetime) -> bool:
    # judge와 같은 허용치를 써야 GET과 제출의 판단이 어긋나지 않는다
    return now > session.deadline + timedelta(seconds=GRACE_SECONDS)


def _record(session: GameSession, word: str, by: str) -> None:
    session.moves.append(Move(word=word, by=by))
    session.used_words.add(word)


def _end(session: GameSession, status: str, reason: str) -> None:
    session.status = status
    session.end_reason = reason
