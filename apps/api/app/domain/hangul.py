"""한글 음절 분해·조합.

끝말잇기 판정은 '앞 단어의 끝 글자'와 '다음 단어의 첫 글자'를 비교하는 일이다.
두음법칙(력 → 역)을 적용하려면 글자를 초성·중성·종성으로 나눠야 하므로,
규칙 엔진 전체가 이 모듈 위에 선다.

유니코드 완성형 한글은 '가'(U+AC00)부터 '힣'(U+D7A3)까지
초성 19 × 중성 21 × 종성 28 = 11,172자가 순서대로 놓여 있어 나눗셈만으로 분해할 수 있다.
"""

HANGUL_BASE = 0xAC00  # '가'
HANGUL_LAST = 0xD7A3  # '힣'
CHO_COUNT = 19
JUNG_COUNT = 21
JONG_COUNT = 28  # 받침 없음(0)을 포함한 개수


def is_hangul_syllable(ch: str) -> bool:
    """완성형 한글 한 글자인지 확인한다. 낱자모('ㄱ')나 두 글자 이상은 False."""
    return len(ch) == 1 and HANGUL_BASE <= ord(ch) <= HANGUL_LAST


def decompose(ch: str) -> tuple[int, int, int]:
    """완성형 한 글자를 (초성, 중성, 종성) 인덱스로 나눈다."""
    if not is_hangul_syllable(ch):
        # 이 모듈은 FastAPI를 모르는 순수 함수라 AppError 대신 ValueError를 쓴다.
        # 사용자 입력 검증은 rule_engine이 먼저 하므로, 여기까지 오면 호출한 코드의 버그다.
        raise ValueError(f"완성형 한글 음절이 아닙니다: {ch!r}")
    code = ord(ch) - HANGUL_BASE
    cho = code // (JUNG_COUNT * JONG_COUNT)
    jung = (code // JONG_COUNT) % JUNG_COUNT
    jong = code % JONG_COUNT
    return cho, jung, jong


def compose(cho: int, jung: int, jong: int = 0) -> str:
    """(초성, 중성, 종성) 인덱스를 완성형 한 글자로 합친다."""
    if not (0 <= cho < CHO_COUNT and 0 <= jung < JUNG_COUNT and 0 <= jong < JONG_COUNT):
        raise ValueError(f"인덱스 범위를 벗어났습니다: {(cho, jung, jong)}")
    return chr(HANGUL_BASE + (cho * JUNG_COUNT + jung) * JONG_COUNT + jong)


# ── 두음법칙 (한글 맞춤법 제10~12항, 단어 첫머리 규칙) ──────────────────
_CHO_N, _CHO_R, _CHO_O = 2, 5, 11  # ㄴ, ㄹ, ㅇ
_R_TO_O = frozenset({2, 6, 7, 12, 17, 20})  # ㄹ + ㅑ ㅕ ㅖ ㅛ ㅠ ㅣ → ㅇ
_R_TO_N = frozenset({0, 1, 8, 11, 13, 18})  # ㄹ + ㅏ ㅐ ㅗ ㅚ ㅜ ㅡ → ㄴ
_N_TO_O = frozenset({6, 12, 17, 20})  # ㄴ + ㅕ ㅛ ㅠ ㅣ → ㅇ


def dueum(ch: str) -> str:
    """두음법칙을 적용한 글자를 돌려준다. 대상이 아니면 그대로 돌려준다.

    표에 없는 조합(러, 레 등)은 바꾸지 않는다. 받침은 항상 유지한다(력 → 역).
    """
    cho, jung, jong = decompose(ch)
    if cho == _CHO_R and jung in _R_TO_O:
        return compose(_CHO_O, jung, jong)
    if cho == _CHO_R and jung in _R_TO_N:
        return compose(_CHO_N, jung, jong)
    if cho == _CHO_N and jung in _N_TO_O:
        return compose(_CHO_O, jung, jong)
    return ch


def allowed_starts(last_char: str) -> tuple[str, ...]:
    """앞 단어의 끝 글자 뒤에 올 수 있는 시작 글자들. 원래 글자가 항상 맨 앞이다.

    집합 대신 튜플을 쓰는 이유: 순서가 고정되어야 AI 후보 순서와 테스트 결과가 재현된다.
    변환은 한 방향이다. '량' 뒤에 '양'은 되지만 '양' 뒤에 '량'은 안 된다.
    """
    converted = dueum(last_char)
    return (last_char,) if converted == last_char else (last_char, converted)
