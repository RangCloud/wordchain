import json
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.domain.hangul import allowed_starts, decompose, dueum

# 앱(node:test)과 함께 쓰는 벡터 파일. 저장소 루트의 shared/에 있다
VECTORS = json.loads(
    (Path(__file__).parents[3] / "shared" / "hangul-vectors.json").read_text(encoding="utf-8")
)

syllables = st.characters(min_codepoint=0xAC00, max_codepoint=0xD7A3)


@pytest.mark.parametrize("v", VECTORS["decompose"], ids=lambda v: v["char"])
def test_vector_decompose(v: dict) -> None:
    assert decompose(v["char"]) == (v["cho"], v["jung"], v["jong"])


# TC-W-01(력→역), TC-W-02(름→늠), TC-W-03(녀→여), TC-W-04(러: 변환 없음) 포함
@pytest.mark.parametrize("v", VECTORS["dueum"], ids=lambda v: v["input"])
def test_vector_dueum(v: dict) -> None:
    assert dueum(v["input"]) == v["output"]


@pytest.mark.parametrize("v", VECTORS["allowedStarts"], ids=lambda v: v["input"])
def test_vector_allowed_starts(v: dict) -> None:
    assert list(allowed_starts(v["input"])) == v["output"]


@given(syllables)
def test_dueum_keeps_vowel_and_final_consonant(ch: str) -> None:
    # 속성: 두음법칙은 첫소리만 바꾼다
    assert decompose(dueum(ch))[1:] == decompose(ch)[1:]


@given(syllables)
def test_dueum_is_idempotent(ch: str) -> None:
    # 속성: 두 번 적용해도 결과가 같다 (ㄹ→ㄴ→ㅇ처럼 연쇄 변환되지 않는다)
    assert dueum(dueum(ch)) == dueum(ch)


@given(syllables)
def test_allowed_starts_always_includes_original(ch: str) -> None:
    starts = allowed_starts(ch)
    assert starts[0] == ch
    assert len(starts) == len(set(starts)) <= 2


def test_dueum_rejects_non_syllable() -> None:
    with pytest.raises(ValueError):
        dueum("a")
