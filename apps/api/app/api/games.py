"""게임 API 5종 (기획서 2-4).

규칙 위반(사전에 없는 단어 등)은 정상적인 게임 진행이므로 200으로 돌려주고 verdict로 알린다.
4xx는 요청 자체가 잘못된 경우(없는 게임, 턴 불일치, 형식 오류)에만 쓴다.

엔드포인트를 async가 아닌 일반 함수로 둔 이유: SQLite 조회가 동기 호출이라
FastAPI가 스레드 풀에서 실행하게 해야 이벤트 루프를 막지 않는다.
"""

from datetime import UTC, datetime
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.core.config import get_settings
from app.repositories.dictionary import SqliteDictionary
from app.schemas.game import (
    CreateGameRequest,
    GameState,
    MoveRequest,
    MoveResponse,
    ResultResponse,
    ResultWord,
)
from app.services.game_service import Clock, GameService, WordBook

router = APIRouter(prefix="/games", tags=["games"])


@lru_cache
def get_dictionary() -> WordBook:
    # 사전 연결은 앱 전체에서 하나만 연다. 첫 게임 요청 때 열어서, 사전이 없어도 health는 동작한다
    return SqliteDictionary(get_settings().dictionary_path)


def get_clock() -> Clock:
    return lambda: datetime.now(UTC)


def get_game_service(
    request: Request,
    dictionary: Annotated[WordBook, Depends(get_dictionary)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> GameService:
    return GameService(repo=request.app.state.game_repo, dictionary=dictionary, clock=clock)


Service = Annotated[GameService, Depends(get_game_service)]
ClockDep = Annotated[Clock, Depends(get_clock)]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=GameState)
def create_game(body: CreateGameRequest, service: Service, clock: ClockDep) -> GameState:
    session = service.create(body.difficulty)
    return GameState.of(session, clock())


@router.get("/{game_id}", response_model=GameState)
def get_game(game_id: str, service: Service, clock: ClockDep) -> GameState:
    return GameState.of(service.get_state(game_id), clock())


@router.post("/{game_id}/moves", response_model=MoveResponse)
def submit_move(game_id: str, body: MoveRequest, service: Service, clock: ClockDep) -> MoveResponse:
    outcome = service.submit_move(game_id, body.turn, body.word)
    return MoveResponse(
        verdict=outcome.verdict,
        ai_word=outcome.ai_word,
        game=GameState.of(outcome.session, clock()),
    )


@router.post("/{game_id}/forfeit", response_model=GameState)
def forfeit_game(game_id: str, service: Service, clock: ClockDep) -> GameState:
    return GameState.of(service.forfeit(game_id), clock())


@router.get("/{game_id}/result", response_model=ResultResponse)
def get_result(game_id: str, service: Service) -> ResultResponse:
    session, words = service.get_result(game_id)
    return ResultResponse(
        game_id=session.game_id,
        difficulty=session.difficulty,
        status=session.status,
        end_reason=session.end_reason,
        score=session.score,
        words=[ResultWord(word=m.word, by=m.by, definition=d) for m, d in words],
    )
