"""AI 수 선택 (G-04).

LLM이 아니라 사전 탐색이다. 없는 단어를 지어내지 않고, 난수 생성기(rng)를 밖에서 받으므로
시드를 고정하면 매번 같은 단어를 낸다 → 자동 테스트가 가능하다.
"""

import math
import random
from collections.abc import Collection
from enum import StrEnum

from app.domain.dictionary import Dictionary
from app.domain.hangul import allowed_starts
from app.domain.rule_engine import next_count

EASY_MAX_LENGTH = 3
EASY_TOP_RATIO = 0.3


class Difficulty(StrEnum):
    EASY = "easy"
    NORMAL = "normal"
    HARD = "hard"


def choose_word(
    *,
    previous_word: str,
    used: Collection[str],
    dictionary: Dictionary,
    difficulty: Difficulty,
    rng: random.Random,
    is_first_turn: bool = False,
) -> str | None:
    """AI가 낼 단어를 고른다. 낼 단어가 없으면 None(= 플레이어 승리)."""
    candidates: list[str] = []
    for start in allowed_starts(previous_word[-1]):
        candidates += [w for w in dictionary.words_starting_with(start) if w not in used]

    # 단어별 '상대가 이어갈 수 있는 단어 수'. 0이면 한방단어다
    counts = {w: next_count(dictionary, w[-1]) for w in candidates}

    # 한방단어는 어려움 난이도에서만, 그것도 첫 턴이 아닐 때만 쓴다
    if difficulty is not Difficulty.HARD or is_first_turn:
        candidates = [w for w in candidates if counts[w] > 0]
    if difficulty is Difficulty.EASY:
        candidates = [w for w in candidates if len(w) <= EASY_MAX_LENGTH]
    if not candidates:
        return None

    if difficulty is Difficulty.NORMAL:
        return rng.choice(candidates)

    if difficulty is Difficulty.HARD:
        # 상대가 가장 잇기 어려운 끝 글자를 고른다. 동률이면 그 안에서 무작위
        fewest = min(counts[w] for w in candidates)
        return rng.choice([w for w in candidates if counts[w] == fewest])

    # 쉬움: 상대가 잇기 쉬운 순으로 줄 세워 상위 30% 안에서 고른다.
    # sorted는 동률의 기존 순서(가나다순)를 유지하므로 결과가 재현된다
    ranked = sorted(candidates, key=lambda w: counts[w], reverse=True)
    top = ranked[: max(1, math.ceil(len(ranked) * EASY_TOP_RATIO))]
    return rng.choice(top)
