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
