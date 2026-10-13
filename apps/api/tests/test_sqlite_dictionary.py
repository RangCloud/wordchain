import random
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.domain.ai_player import Difficulty, choose_word
from app.domain.dictionary import Dictionary
from app.repositories.dictionary import SqliteDictionary
from scripts.build_dictionary import Entry, write_database
from tests.domain_fixtures import WORDS, make_dictionary

MEMORY = make_dictionary()


@pytest.fixture
def sqlite_dict(tmp_path: Path) -> Iterator[SqliteDictionary]:
    # 메모리 사전과 같은 단어로 임시 DB를 만든다 (1글자 "술"은 구축 단계에서 걸러지는 대상)
    path = tmp_path / "dict.sqlite"
    entries = {w: Entry(w, f"{w}의 뜻", None) for w in WORDS if len(w) >= 2}
    write_database(path, entries, "test")
    dictionary = SqliteDictionary(path)
    yield dictionary
    dictionary.close()


def test_matches_in_memory_dictionary(sqlite_dict: SqliteDictionary) -> None:
    # 계약 테스트: 두 구현이 같은 질문에 같은 답을 해야 엔진을 그대로 쓸 수 있다
    for word in [*WORDS, "없는말", ""]:
        assert sqlite_dict.contains(word) == MEMORY.contains(word)
    for ch in {w[0] for w in WORDS} | {"쁨", "a"}:
        assert sqlite_dict.count_starting_with(ch) == MEMORY.count_starting_with(ch)
        assert sqlite_dict.words_starting_with(ch) == MEMORY.words_starting_with(ch)


def test_definition(sqlite_dict: SqliteDictionary) -> None:
    assert sqlite_dict.definition("사과") == "사과의 뜻"
    assert sqlite_dict.definition("없는말") is None


def test_ai_gives_same_word_with_either_dictionary(sqlite_dict: SqliteDictionary) -> None:
    def pick(dictionary: Dictionary) -> str | None:
        return choose_word(
            previous_word="일기",
            used=("일기",),
            dictionary=dictionary,
            difficulty=Difficulty.NORMAL,
            rng=random.Random(3),
        )

    assert pick(sqlite_dict) == pick(MEMORY)


def test_is_read_only(sqlite_dict: SqliteDictionary) -> None:
    import sqlite3

    with pytest.raises(sqlite3.OperationalError):
        sqlite_dict._con.execute("DELETE FROM words")


def test_missing_file_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        SqliteDictionary(tmp_path / "none.sqlite")
