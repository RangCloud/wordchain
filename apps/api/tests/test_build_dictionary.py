import sqlite3
from pathlib import Path

import pytest

from scripts.build_dictionary import (
    Entry,
    clean_word,
    extract_entries,
    merge_entries,
    syllable_stats,
    write_database,
)


def item(
    word: str,
    *,
    pos: str = "명사",
    unit: str = "단어",
    sense_type: str = "일반어",
    definition: str = "뜻풀이",
    cat: str | None = None,
) -> dict:
    """원본 JSON 한 항목과 같은 모양의 최소 데이터."""
    sense: dict = {"definition": definition, "type": sense_type}
    if cat:
        sense["cat_info"] = [{"cat": cat}]
    return {
        "word_info": {
            "word": word,
            "word_unit": unit,
            "pos_info": [{"pos": pos, "comm_pattern_info": [{"sense_info": [sense]}]}],
        }
    }


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("각본01", "각본"),  # 동음이의어 번호
        ("각-봉투", "각봉투"),  # 형태소 경계
        ("가격^경쟁", "가격경쟁"),  # 띄어 쓸 수 있음 표시
        ("가격 경쟁", "가격경쟁"),
        ("강", None),  # 1글자
        ("ㄱ자", None),  # 낱자모 포함
        ("A형", None),
        ("", None),
    ],
)
def test_clean_word(raw: str, expected: str | None) -> None:
    assert clean_word(raw) == expected


def test_extract_keeps_only_general_nouns() -> None:
    items = [
        item("사과01"),
        item("먹다", pos="동사"),
        item("것", pos="의존 명사"),
        item("가는 말이 고와야", unit="속담"),
        item("강냉이", sense_type="방언"),
        item("인민", sense_type="북한어"),
        item("가람", sense_type="옛말"),
        item("빈뜻", definition="  "),
        item("각막", cat="의학"),
    ]

    assert list(extract_entries(items)) == [
        Entry("사과", "뜻풀이", None),
        Entry("각막", "뜻풀이", "의학"),
    ]


def test_merge_prefers_general_sense() -> None:
    merged = merge_entries(
        [
            Entry("사과", "전문 뜻", "식물"),
            Entry("사과", "일반 뜻", None),
            Entry("사과", "다른 일반 뜻", None),
        ]
    )

    assert merged == {"사과": Entry("사과", "일반 뜻", None)}


def test_syllable_stats_counts_dueum_starts() -> None:
    stats = syllable_stats(["역량", "양말", "말미", "기쁨"])

    assert stats == {"량": 1, "말": 1, "미": 0, "쁨": 0}  # 량 → 양(양말)


def test_write_database(tmp_path: Path) -> None:
    path = tmp_path / "dict.sqlite"
    entries = merge_entries([Entry("양말", "발에 신는 것", None), Entry("역량", "힘", None)])

    write_database(path, entries, "20260906")
    write_database(path, entries, "20260906")  # 다시 만들어도 오류 없이 덮어쓴다

    con = sqlite3.connect(path)
    try:
        assert con.execute("SELECT word, first_char, last_char, length FROM words").fetchall() == [
            ("양말", "양", "말", 2),
            ("역량", "역", "량", 2),
        ]
        assert dict(con.execute("SELECT * FROM syllable_stats")) == {"말": 0, "량": 1}
        meta = dict(con.execute("SELECT * FROM meta"))
        assert meta["word_count"] == "2"
        assert "CC BY-SA" in meta["license"]
    finally:
        con.close()
