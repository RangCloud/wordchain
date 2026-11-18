"""게임 API 요청·응답 스키마 (기획서 2-4)."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.domain.ai_player import Difficulty
from app.domain.rule_engine import Verdict
from app.repositories.game_repo import GameSession
from app.services.game_service import START_LIVES, TURN_SECONDS

# 앞뒤 공백만 있는 입력은 판정할 단어가 없으므로 요청 오류(422)로 본다.
# 50자 상한은 비정상적으로 긴 입력이 사전 조회까지 가지 않게 막는다
WordInput = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]


class CreateGameRequest(BaseModel):
    difficulty: Difficulty = Difficulty.NORMAL


class MoveRequest(BaseModel):
    turn: int = Field(ge=1)
    word: WordInput


class MoveOut(BaseModel):
    word: str
    by: str


class GameState(BaseModel):
    game_id: str
    difficulty: Difficulty
    status: str
    end_reason: str | None
    turn: int
    lives: int
    # 앱이 상수를 따로 들고 있으면 서버 규칙이 바뀔 때 어긋나므로, 기준값도 함께 내려준다
    max_lives: int
    turn_seconds: int
    score: int
    deadline: datetime
    server_time: datetime  # 앱이 기기 시계와의 차이를 보정해 남은 시간을 그리도록 함께 준다
    last_word: str | None
    allowed_starts: list[str]
    moves: list[MoveOut]

    @classmethod
    def of(cls, session: GameSession, server_time: datetime) -> "GameState":
        return cls(
            game_id=session.game_id,
            difficulty=session.difficulty,
            status=session.status,
            end_reason=session.end_reason,
            turn=session.turn,
            lives=session.lives,
            max_lives=START_LIVES,
            turn_seconds=TURN_SECONDS[session.difficulty],
            score=session.score,
            deadline=session.deadline,
            server_time=server_time,
            last_word=session.last_word,
            allowed_starts=session.allowed_starts,
            moves=[MoveOut(word=m.word, by=m.by) for m in session.moves],
        )


class MoveResponse(BaseModel):
    verdict: Verdict
    ai_word: str | None
    game: GameState


class ResultWord(BaseModel):
    word: str
    by: str
    definition: str | None


class ResultResponse(BaseModel):
    game_id: str
    difficulty: Difficulty
    status: str
    end_reason: str | None
    score: int
    words: list[ResultWord]
