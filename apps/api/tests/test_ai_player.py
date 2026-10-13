import random

import pytest

from app.domain.ai_player import Difficulty, choose_word
from app.domain.dictionary import InMemoryDictionary
from app.domain.rule_engine import Verdict, judge
from tests.domain_fixtures import make_dictionary

DICT = make_dictionary()
SEEDS = range(30)


def pick(
    previous_word: str,
    difficulty: Difficulty,
    seed: int = 0,
    used: tuple[str, ...] | None = None,
    is_first_turn: bool = False,
) -> str | None:
    return choose_word(
        previous_word=previous_word,
        used=used if used is not None else (previous_word,),
        dictionary=DICT,
        difficulty=difficulty,
        rng=random.Random(seed),
        is_first_turn=is_first_turn,
    )


@pytest.mark.parametrize("difficulty", list(Difficulty))
def test_tc_w_12_no_candidates_returns_none(difficulty: Difficulty) -> None:
    # "쁨"으로 시작하는 단어가 없다 → AI 패배
    assert pick("기쁨", difficulty) is None


def test_used_words_are_excluded() -> None:
    assert pick("양말", Difficulty.NORMAL, used=("양말", "말미")) is None


def test_uses_dueum_start() -> None:
    # 례 → 예
    assert pick("차례", Difficulty.NORMAL) == "예술"


def test_hard_prefers_hanbang() -> None:
    assert {pick("일기", Difficulty.HARD, s) for s in SEEDS} == {"기쁨"}


def test_hard_avoids_hanbang_on_first_turn() -> None:
    picked = {pick("일기", Difficulty.HARD, s, is_first_turn=True) for s in SEEDS}
    assert "기쁨" not in picked
    assert picked <= {"기름", "기차", "기상예보"}


def test_normal_never_uses_hanbang_and_varies() -> None:
    picked = {pick("일기", Difficulty.NORMAL, s) for s in SEEDS}
    assert "기쁨" not in picked
    assert len(picked) > 1


def test_easy_uses_short_words_only() -> None:
    picked = {pick("일기", Difficulty.EASY, s) for s in SEEDS}
    assert picked <= {"기름", "기차"}


def test_easy_prefers_endings_that_are_easy_to_continue() -> None:
    # "가기"(기: 2개)가 "가락"(락/낙: 1개)보다 잇기 쉬우므로 상위 30%에는 "가기"만 남는다
    d = InMemoryDictionary(["가기", "가락", "기름", "기차", "낙지", "지기", "늠름", "차기"])
    picked = {
        choose_word(
            previous_word="휴가",
            used=(),
            dictionary=d,
            difficulty=Difficulty.EASY,
            rng=random.Random(s),
        )
        for s in SEEDS
    }
    assert picked == {"가기"}


def play_ai_vs_ai(seed: int, difficulty: Difficulty) -> list[str]:
    rng = random.Random(seed)
    words = ["사과"]
    while True:
        word = choose_word(
            previous_word=words[-1],
            used=words,
            dictionary=DICT,
            difficulty=difficulty,
            rng=rng,
        )
        if word is None:
            return words
        words.append(word)


@pytest.mark.parametrize("difficulty", list(Difficulty))
def test_tc_w_11_same_seed_gives_same_game(difficulty: Difficulty) -> None:
    assert play_ai_vs_ai(42, difficulty) == play_ai_vs_ai(42, difficulty)


@pytest.mark.parametrize("difficulty", list(Difficulty))
@pytest.mark.parametrize("seed", range(10))
def test_every_ai_word_passes_the_rule_engine(difficulty: Difficulty, seed: int) -> None:
    # AI가 고른 단어는 규칙 엔진이 봐도 항상 유효해야 한다 (두 모듈의 규칙이 어긋나지 않는지)
    words = play_ai_vs_ai(seed, difficulty)
    for i in range(1, len(words)):
        verdict = judge(
            words[i],
            previous_word=words[i - 1],
            used=words[:i],
            dictionary=DICT,
            is_first_turn=False,
            now=0,
            deadline=0,
        )
        assert verdict is Verdict.OK
