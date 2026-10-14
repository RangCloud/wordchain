"""게임 API 통합 테스트 (기획서 2-4, TC-W-13~17).

실제 SQLite 사전 대신 작은 메모리 사전을, 실제 시계 대신 직접 돌리는 가짜 시계를 끼운다.
그래야 '마감 1.5초 후' 같은 경계값을 기다리지 않고 정확히 재현할 수 있다.
"""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.api.games import get_clock, get_dictionary
from app.domain.dictionary import InMemoryDictionary
from app.main import create_app
from tests.domain_fixtures import WORDS


class FakeClock:
    def __init__(self) -> None:
        self.now = datetime(2026, 1, 1, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **kwargs: float) -> None:
        self.now += timedelta(**kwargs)


class FakeWordBook(InMemoryDictionary):
    def definition(self, word: str) -> str | None:
        return f"{word}의 뜻" if self.contains(word) else None


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def api(clock: FakeClock) -> Iterator[TestClient]:
    app = create_app()
    book = FakeWordBook(WORDS)
    app.dependency_overrides[get_dictionary] = lambda: book
    app.dependency_overrides[get_clock] = lambda: clock
    yield TestClient(app)
    app.dependency_overrides.clear()


def new_game(api: TestClient, difficulty: str = "normal") -> dict:
    res = api.post("/v1/games", json={"difficulty": difficulty})
    assert res.status_code == 201
    return res.json()


def move(api: TestClient, game_id: str, turn: int, word: str) -> dict:
    res = api.post(f"/v1/games/{game_id}/moves", json={"turn": turn, "word": word})
    assert res.status_code == 200, res.text
    return res.json()


# --- G-01 게임 생성 ---


def test_create_game_returns_initial_state(api: TestClient, clock: FakeClock) -> None:
    game = new_game(api)

    assert game["status"] == "playing"
    assert game["lives"] == 3
    assert game["turn"] == 1
    assert game["moves"] == []
    assert datetime.fromisoformat(game["deadline"]) == clock.now + timedelta(seconds=15)


def test_hard_game_has_10_second_turn(api: TestClient, clock: FakeClock) -> None:
    game = new_game(api, "hard")

    assert datetime.fromisoformat(game["deadline"]) == clock.now + timedelta(seconds=10)


def test_unknown_difficulty_is_validation_error(api: TestClient) -> None:
    res = api.post("/v1/games", json={"difficulty": "insane"})

    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


# --- G-03/G-04 턴 진행 ---


def test_ok_move_gets_ai_reply_and_new_deadline(api: TestClient, clock: FakeClock) -> None:
    game = new_game(api)
    clock.advance(seconds=5)

    body = move(api, game["game_id"], 1, "역량")

    assert body["verdict"] == "OK"
    assert body["ai_word"] == "양말"  # 량/양으로 시작하는 단어는 양말뿐
    state = body["game"]
    assert state["turn"] == 2
    assert state["last_word"] == "양말"
    assert state["allowed_starts"] == ["말"]
    assert [m["by"] for m in state["moves"]] == ["player", "ai"]
    assert datetime.fromisoformat(state["deadline"]) == clock.now + timedelta(seconds=15)


def test_surrounding_whitespace_is_trimmed(api: TestClient) -> None:
    game = new_game(api)

    body = move(api, game["game_id"], 1, "  역량 ")

    assert body["verdict"] == "OK"


@pytest.mark.parametrize("word", ["", "   ", "가" * 51])
def test_empty_or_too_long_word_is_validation_error(api: TestClient, word: str) -> None:
    game = new_game(api)

    res = api.post(f"/v1/games/{game['game_id']}/moves", json={"turn": 1, "word": word})

    assert res.status_code == 422


def test_invalid_word_costs_a_life_and_keeps_deadline(api: TestClient) -> None:
    game = new_game(api)

    body = move(api, game["game_id"], 1, "기쁨")  # 첫 턴 한방단어

    assert body["verdict"] == "HANBANG_FIRST_TURN"
    assert body["ai_word"] is None
    assert body["game"]["lives"] == 2
    assert body["game"]["turn"] == 2
    # 다시 입력하는 동안에도 시간은 흐르므로 마감 시각은 바뀌지 않는다
    assert body["game"]["deadline"] == game["deadline"]


def test_player_wins_when_ai_has_no_word(api: TestClient) -> None:
    game_id = new_game(api)["game_id"]

    assert move(api, game_id, 1, "사과")["ai_word"] == "과자"
    assert move(api, game_id, 2, "자리")["ai_word"] == "이름"
    body = move(api, game_id, 3, "늠름")  # 름/늠으로 시작하는 단어는 늠름뿐인데 이미 썼다

    assert body["ai_word"] is None
    assert body["game"]["status"] == "won"
    assert body["game"]["end_reason"] == "AI_STUCK"
    assert body["game"]["score"] == 150  # 100 × 보통 배율 1.5


# --- G-05 타이머 ---


def test_tc_w_13_submit_after_grace_is_timeout(api: TestClient, clock: FakeClock) -> None:
    game = new_game(api)
    clock.advance(seconds=15 + 1.5)

    body = move(api, game["game_id"], 1, "역량")

    assert body["verdict"] == "TIMEOUT"
    assert body["game"]["status"] == "lost"
    assert body["game"]["end_reason"] == "TIMEOUT"


def test_tc_w_14_submit_within_grace_is_judged(api: TestClient, clock: FakeClock) -> None:
    game = new_game(api)
    clock.advance(seconds=15 + 0.5)

    body = move(api, game["game_id"], 1, "역량")

    assert body["verdict"] == "OK"
    assert body["game"]["status"] == "playing"


def test_get_after_deadline_settles_timeout(api: TestClient, clock: FakeClock) -> None:
    # 앱이 백그라운드에 있다가 돌아와 상태를 조회하는 경우 (TC-W-18의 서버 쪽)
    game = new_game(api)
    clock.advance(seconds=20)

    state = api.get(f"/v1/games/{game['game_id']}").json()

    assert state["status"] == "lost"
    assert state["end_reason"] == "TIMEOUT"


# --- G-06 목숨 ---


def test_tc_w_15_three_invalid_words_lose_the_game(api: TestClient) -> None:
    game_id = new_game(api)["game_id"]

    verdicts = [move(api, game_id, turn, "없는말")["verdict"] for turn in (1, 2)]
    last = move(api, game_id, 3, "apple")

    assert verdicts == ["NOT_IN_DICT", "NOT_IN_DICT"]
    assert last["verdict"] == "INVALID_CHARS"
    assert last["game"]["lives"] == 0
    assert last["game"]["status"] == "lost"
    assert last["game"]["end_reason"] == "NO_LIVES"


# --- API 오류 ---


def test_tc_w_16_same_turn_twice_is_rejected(api: TestClient) -> None:
    game_id = new_game(api)["game_id"]
    move(api, game_id, 1, "없는말")

    res = api.post(f"/v1/games/{game_id}/moves", json={"turn": 1, "word": "없는말"})

    assert res.status_code == 409
    assert res.json()["error"]["code"] == "TURN_MISMATCH"
    # 재전송이 목숨을 한 번 더 깎으면 안 된다
    assert api.get(f"/v1/games/{game_id}").json()["lives"] == 2


def test_tc_w_17_game_expires_after_30_minutes(api: TestClient, clock: FakeClock) -> None:
    game_id = new_game(api)["game_id"]

    clock.advance(minutes=30)
    assert api.get(f"/v1/games/{game_id}").status_code == 200

    clock.advance(minutes=1)
    res = api.get(f"/v1/games/{game_id}")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "GAME_NOT_FOUND"


def test_unknown_game_is_not_found(api: TestClient) -> None:
    res = api.post("/v1/games/nope/moves", json={"turn": 1, "word": "역량"})

    assert res.status_code == 404
    assert res.json()["error"]["code"] == "GAME_NOT_FOUND"


def test_move_on_ended_game_is_rejected(api: TestClient) -> None:
    game_id = new_game(api)["game_id"]
    api.post(f"/v1/games/{game_id}/forfeit")

    res = api.post(f"/v1/games/{game_id}/moves", json={"turn": 1, "word": "역량"})

    assert res.status_code == 409
    assert res.json()["error"]["code"] == "GAME_ALREADY_ENDED"


# --- 기권 · 결과 (G-07) ---


def test_forfeit_ends_game_once(api: TestClient) -> None:
    game_id = new_game(api)["game_id"]

    first = api.post(f"/v1/games/{game_id}/forfeit")
    second = api.post(f"/v1/games/{game_id}/forfeit")

    assert first.status_code == 200
    assert first.json()["status"] == "lost"
    assert first.json()["end_reason"] == "FORFEIT"
    assert second.status_code == 409


def test_result_lists_words_with_definitions(api: TestClient) -> None:
    game_id = new_game(api)["game_id"]
    move(api, game_id, 1, "역량")
    api.post(f"/v1/games/{game_id}/forfeit")

    body = api.get(f"/v1/games/{game_id}/result").json()

    assert body["status"] == "lost"
    assert body["score"] == 0
    assert body["words"] == [
        {"word": "역량", "by": "player", "definition": "역량의 뜻"},
        {"word": "양말", "by": "ai", "definition": "양말의 뜻"},
    ]


def test_result_of_playing_game_is_rejected(api: TestClient) -> None:
    game_id = new_game(api)["game_id"]

    res = api.get(f"/v1/games/{game_id}/result")

    assert res.status_code == 409
    assert res.json()["error"]["code"] == "GAME_IN_PROGRESS"
