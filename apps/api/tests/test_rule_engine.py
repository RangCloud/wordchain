import pytest

from app.domain.rule_engine import GRACE_SECONDS, Verdict, judge, next_count
from tests.domain_fixtures import make_dictionary

DICT = make_dictionary()
DEADLINE = 1000.0


def run(
    word: str,
    *,
    previous_word: str | None = "역량",
    used: tuple[str, ...] = ("역량",),
    is_first_turn: bool = False,
    now: float = DEADLINE - 5,
) -> Verdict:
    return judge(
        word,
        previous_word=previous_word,
        used=used,
        dictionary=DICT,
        is_first_turn=is_first_turn,
        now=now,
        deadline=DEADLINE,
    )


def test_tc_w_05_dueum_start_is_ok() -> None:
    # "역량" 다음에 "양말": 량 → 양 변환 허용
    assert run("양말") is Verdict.OK


def test_same_char_start_is_ok() -> None:
    assert run("일기", previous_word="내일", used=("내일",)) is Verdict.OK


def test_dueum_is_one_way() -> None:
    # "양" 뒤에 "량"으로 시작하는 단어는 안 된다
    assert run("량말", previous_word="미양", used=()) is Verdict.WRONG_START


@pytest.mark.parametrize("word", ["apple", "사과1", "사 과", "ㄱㄴ", "사과!", ""])
def test_tc_w_06_invalid_chars(word: str) -> None:
    assert run(word) is Verdict.INVALID_CHARS


def test_tc_w_07_too_short() -> None:
    assert run("양") is Verdict.TOO_SHORT


def test_tc_w_08_wrong_start_comes_before_not_in_dict() -> None:
    # 시작 글자도 틀리고 사전에도 없으면 순서상 WRONG_START
    assert run("바나쿠") is Verdict.WRONG_START


def test_tc_w_09_already_used() -> None:
    assert run("양말", used=("역량", "양말")) is Verdict.ALREADY_USED


def test_already_used_comes_before_not_in_dict() -> None:
    assert run("양파링", used=("역량", "양파링")) is Verdict.ALREADY_USED


def test_not_in_dict() -> None:
    assert run("양파링") is Verdict.NOT_IN_DICT


def test_tc_w_10_hanbang_on_first_turn() -> None:
    verdict = run("기쁨", previous_word=None, used=(), is_first_turn=True)
    assert verdict is Verdict.HANBANG_FIRST_TURN


def test_hanbang_allowed_after_first_turn() -> None:
    assert run("기쁨", previous_word="일기", used=("일기",)) is Verdict.OK


def test_first_word_skips_start_check() -> None:
    assert run("사과", previous_word=None, used=(), is_first_turn=True) is Verdict.OK


@pytest.mark.parametrize(
    ("late_by", "expected"),
    [
        (0.5, Verdict.OK),  # TC-W-14: 지연 허용치 이내
        (GRACE_SECONDS, Verdict.OK),  # 경계값: 정확히 허용치
        (GRACE_SECONDS + 0.001, Verdict.TIMEOUT),  # 경계값 바로 뒤
        (1.5, Verdict.TIMEOUT),  # TC-W-13
    ],
)
def test_timeout_boundary(late_by: float, expected: Verdict) -> None:
    assert run("양말", now=DEADLINE + late_by) is expected


def test_timeout_comes_first() -> None:
    assert run("apple", now=DEADLINE + 5) is Verdict.TIMEOUT


@pytest.mark.parametrize(("last_char", "count"), [("기", 4), ("량", 1), ("름", 1), ("쁨", 0)])
def test_next_count_includes_dueum(last_char: str, count: int) -> None:
    assert next_count(DICT, last_char) == count
