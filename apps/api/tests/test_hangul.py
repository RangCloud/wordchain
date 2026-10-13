import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.domain.hangul import compose, decompose, is_hangul_syllable

# 완성형 한글 11,172자 전체에서 무작위로 뽑는다
syllables = st.characters(min_codepoint=0xAC00, max_codepoint=0xD7A3)


@pytest.mark.parametrize(
    ("ch", "expected"),
    [
        ("가", (0, 0, 0)),  # 첫 글자 (경계값)
        ("힣", (18, 20, 27)),  # 끝 글자 (경계값)
        ("한", (18, 0, 4)),  # ㅎ + ㅏ + ㄴ
        ("력", (5, 6, 1)),  # ㄹ + ㅕ + ㄱ, 두음법칙 대상 글자
    ],
)
def test_decompose_known_values(ch: str, expected: tuple[int, int, int]) -> None:
    assert decompose(ch) == expected


@given(syllables)
def test_decompose_then_compose_returns_original(ch: str) -> None:
    # 속성: 어떤 글자든 분해했다가 다시 조합하면 원래 글자가 나온다
    assert compose(*decompose(ch)) == ch


@given(st.integers(0, 18), st.integers(0, 20), st.integers(0, 27))
def test_compose_then_decompose_returns_original(cho: int, jung: int, jong: int) -> None:
    # 반대 방향도 성립해야 두 함수가 서로의 역함수라고 말할 수 있다
    assert decompose(compose(cho, jung, jong)) == (cho, jung, jong)


def test_compose_defaults_to_no_final_consonant() -> None:
    assert compose(0, 0) == "가"


@pytest.mark.parametrize("bad", ["a", "ㄱ", "ㅏ", "1", " ", "", "가나", "꯿", "힤"])
def test_rejects_non_syllable(bad: str) -> None:
    # 낱자모, 빈 문자열, 두 글자, 범위 바로 앞뒤 문자(경계값)는 모두 거부한다
    assert not is_hangul_syllable(bad)
    with pytest.raises(ValueError):
        decompose(bad)


@pytest.mark.parametrize("index", [(-1, 0, 0), (19, 0, 0), (0, -1, 0), (0, 21, 0), (0, 0, 28)])
def test_compose_rejects_out_of_range(index: tuple[int, int, int]) -> None:
    with pytest.raises(ValueError):
        compose(*index)
