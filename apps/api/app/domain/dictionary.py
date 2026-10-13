"""사전 인터페이스.

규칙 엔진과 AI는 '사전에게 물어볼 수 있는 질문'만 알고, 사전이 SQLite인지 메모리인지는 모른다.
덕분에 실제 사전 DB가 없어도 엔진을 완성·검증할 수 있고, 테스트에서는 작은 가짜 사전을 넣는다.
"""

from collections.abc import Iterable
from typing import Protocol


class Dictionary(Protocol):
    def contains(self, word: str) -> bool:
        """사전에 등재된 명사인지."""
        ...

    def count_starting_with(self, first_char: str) -> int:
        """이 글자로 시작하는 단어 수."""
        ...

    def words_starting_with(self, first_char: str) -> list[str]:
        """이 글자로 시작하는 단어 목록. 반드시 가나다순(시드 고정 시 AI 결과 재현을 위해)."""
        ...


class InMemoryDictionary:
    """테스트와 로컬 실험용 사전. 2글자 이상 단어만 받는다(게임 규칙 1)."""

    def __init__(self, words: Iterable[str]) -> None:
        self._words = frozenset(w for w in words if len(w) >= 2)
        by_first: dict[str, list[str]] = {}
        for word in sorted(self._words):
            by_first.setdefault(word[0], []).append(word)
        self._by_first = by_first

    def contains(self, word: str) -> bool:
        return word in self._words

    def count_starting_with(self, first_char: str) -> int:
        return len(self._by_first.get(first_char, ()))

    def words_starting_with(self, first_char: str) -> list[str]:
        return list(self._by_first.get(first_char, ()))
