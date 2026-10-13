"""단어 판정 (G-03).

가벼운 검사를 먼저, 사전 조회를 나중에 한다. 순서가 고정되어 있어야
같은 입력에 항상 같은 결과 코드가 나와 테스트가 결정적이 된다.
"""

from collections.abc import Collection
from enum import StrEnum

from app.domain.dictionary import Dictionary
from app.domain.hangul import allowed_starts, is_hangul_syllable

# 네트워크 지연으로 억울하게 지는 일을 막기 위한 허용치 (G-05)
GRACE_SECONDS = 1.0


class Verdict(StrEnum):
    TIMEOUT = "TIMEOUT"
    INVALID_CHARS = "INVALID_CHARS"
    TOO_SHORT = "TOO_SHORT"
    WRONG_START = "WRONG_START"
    ALREADY_USED = "ALREADY_USED"
    NOT_IN_DICT = "NOT_IN_DICT"
    HANBANG_FIRST_TURN = "HANBANG_FIRST_TURN"
    OK = "OK"


def next_count(dictionary: Dictionary, last_char: str) -> int:
    """이 글자로 끝난 단어 뒤에 이어갈 수 있는 단어 수(두음법칙 포함). 0이면 한방 글자.

    이번 판에 이미 쓴 단어는 따지지 않는다. 한방 여부는 사전만으로 정해져야 미리 계산해 둘 수 있다.
    """
    return sum(dictionary.count_starting_with(ch) for ch in allowed_starts(last_char))


def judge(
    word: str,
    *,
    previous_word: str | None,
    used: Collection[str],
    dictionary: Dictionary,
    is_first_turn: bool,
    now: float,
    deadline: float,
) -> Verdict:
    """제출된 단어를 판정한다.

    시각(now, deadline)을 인자로 받는 이유: 엔진이 직접 시계를 보면 순수 함수가 아니게 되고,
    '마감 1.5초 후' 같은 경계값을 테스트에서 재현할 수 없다.
    previous_word가 None이면(선공의 첫 단어) 시작 글자 검사를 건너뛴다.
    """
    if now > deadline + GRACE_SECONDS:
        return Verdict.TIMEOUT
    if not word or not all(is_hangul_syllable(ch) for ch in word):
        return Verdict.INVALID_CHARS
    if len(word) < 2:
        return Verdict.TOO_SHORT
    if previous_word is not None and word[0] not in allowed_starts(previous_word[-1]):
        return Verdict.WRONG_START
    if word in used:
        return Verdict.ALREADY_USED
    if not dictionary.contains(word):
        return Verdict.NOT_IN_DICT
    if is_first_turn and next_count(dictionary, word[-1]) == 0:
        return Verdict.HANBANG_FIRST_TURN
    return Verdict.OK
