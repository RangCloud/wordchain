"""표준국어대사전 원본(JSON) → 게임용 SQLite 사전.

실행 (apps/api 폴더에서):
    uv run python -m scripts.build_dictionary

읽는 것은 표제어·품사·뜻풀이·전문 분야뿐이다. 용례(예문)와 발음·이미지 등은
별도 허락이 필요한 자료라 읽지 않는다(README '사전 데이터 출처와 라이선스' 참고).
"""

import json
import re
import sqlite3
from collections import Counter
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.domain.hangul import allowed_starts, is_hangul_syllable

API_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = API_DIR / "data" / "raw"
OUTPUT_PATH = API_DIR / "data" / "dictionary.sqlite"

SOURCE = "국립국어원 표준국어대사전 (https://stdict.korean.go.kr)"
LICENSE = "CC BY-SA 2.0 KR (https://creativecommons.org/licenses/by-sa/2.0/kr/)"

# 표제어에 붙는 표시: 형태소 경계(-), 띄어 쓸 수 있음(^), 공백, 동음이의어 번호(01)
_MARKS = re.compile(r"[-^\s]|\d+$")

SCHEMA = """
CREATE TABLE words (
    id INTEGER PRIMARY KEY,
    word TEXT NOT NULL UNIQUE,
    first_char TEXT NOT NULL,
    last_char TEXT NOT NULL,
    length INTEGER NOT NULL,
    definition TEXT NOT NULL,
    category TEXT  -- 전문 분야. NULL이면 일반어 (쉬움·보통 AI가 전문어를 피하는 데 쓴다)
);
CREATE INDEX idx_words_first_char ON words (first_char);
CREATE INDEX idx_words_first_char_length ON words (first_char, length);
CREATE TABLE syllable_stats (syllable TEXT PRIMARY KEY, next_count INTEGER NOT NULL);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


@dataclass(frozen=True)
class Entry:
    word: str
    definition: str
    category: str | None


def clean_word(raw: str) -> str | None:
    """표제어 표시를 떼어 낸다. 완성형 한글 2글자 이상이 아니면 None."""
    word = _MARKS.sub("", raw)
    if len(word) < 2 or not all(is_hangul_syllable(ch) for ch in word):
        return None
    return word


def extract_entries(items: Iterable[dict]) -> Iterator[Entry]:
    """원본 항목에서 게임에 쓸 명사를 뽑는다.

    쓰는 것: 단위가 '단어'이고 품사가 '명사'이며 뜻 유형이 '일반어'인 것.
    빼는 것: 구·속담·관용구, 의존 명사, 방언·북한어·옛말(플레이어가 알기 어렵고 판정 시비가 생긴다).
    """
    for item in items:
        info = item.get("word_info", {})
        if info.get("word_unit") != "단어":
            continue
        word = clean_word(info.get("word", ""))
        if word is None:
            continue
        for pos in info.get("pos_info", []):
            if pos.get("pos") != "명사":
                continue
            for pattern in pos.get("comm_pattern_info", []):
                for sense in pattern.get("sense_info", []):
                    definition = sense.get("definition", "").strip()
                    if sense.get("type") != "일반어" or not definition:
                        continue
                    cats = sense.get("cat_info") or []
                    yield Entry(word, definition, cats[0]["cat"] if cats else None)


def merge_entries(entries: Iterable[Entry]) -> dict[str, Entry]:
    """같은 단어의 여러 뜻 중 하나만 남긴다. 일반어 뜻이 전문 분야 뜻보다 우선한다."""
    merged: dict[str, Entry] = {}
    for entry in entries:
        current = merged.get(entry.word)
        if current is None or (current.category is not None and entry.category is None):
            merged[entry.word] = entry
    return merged


def syllable_stats(words: Iterable[str]) -> dict[str, int]:
    """끝 글자별 '이어갈 수 있는 단어 수'(두음법칙 포함). 0이면 한방 글자."""
    words = list(words)
    starts = Counter(w[0] for w in words)
    return {last: sum(starts[ch] for ch in allowed_starts(last)) for last in {w[-1] for w in words}}


def write_database(path: Path, entries: dict[str, Entry], version: str) -> None:
    path.unlink(missing_ok=True)
    con = sqlite3.connect(path)
    try:
        con.executescript(SCHEMA)
        con.executemany(
            "INSERT INTO words (word, first_char, last_char, length, definition, category)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            # 가나다순으로 넣어 두면 같은 원본에서 항상 같은 파일이 나온다
            [
                (e.word, e.word[0], e.word[-1], len(e.word), e.definition, e.category)
                for e in sorted(entries.values(), key=lambda e: e.word)
            ],
        )
        con.executemany(
            "INSERT INTO syllable_stats VALUES (?, ?)", sorted(syllable_stats(entries).items())
        )
        con.executemany(
            "INSERT INTO meta VALUES (?, ?)",
            [
                ("source", SOURCE),
                ("license", LICENSE),
                ("source_version", version),
                ("built_at", datetime.now(UTC).isoformat(timespec="seconds")),
                ("word_count", str(len(entries))),
            ],
        )
        con.commit()
    finally:
        con.close()


def read_raw(raw_dir: Path) -> Iterator[dict]:
    for file in sorted(raw_dir.glob("*.json")):
        yield from json.loads(file.read_text(encoding="utf-8"))["channel"]["item"]


def main() -> None:
    files = sorted(RAW_DIR.glob("*.json"))
    if not files:
        raise SystemExit(f"원본이 없습니다: {RAW_DIR} (README의 사전 데이터 안내 참고)")
    version = json.loads(files[0].read_text(encoding="utf-8"))["channel"]["lastBuildDate"]
    entries = merge_entries(extract_entries(read_raw(RAW_DIR)))
    write_database(OUTPUT_PATH, entries, version)
    stats = syllable_stats(entries)
    hanbang = sum(1 for count in stats.values() if count == 0)
    print(f"단어 {len(entries):,}개, 끝 글자 {len(stats):,}종(한방 글자 {hanbang:,}종)")
    print(f"저장: {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size / 1_000_000:.1f}MB)")


if __name__ == "__main__":
    main()
