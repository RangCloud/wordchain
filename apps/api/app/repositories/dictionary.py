"""SQLite 사전 조회.

domain.dictionary.Dictionary 인터페이스의 실제 구현이다.
규칙 엔진과 AI는 이 클래스를 모르고 인터페이스만 알기 때문에,
테스트의 메모리 사전과 바꿔 끼울 수 있다.
"""

import sqlite3
from pathlib import Path


class SqliteDictionary:
    def __init__(self, path: Path) -> None:
        if not path.is_file():
            # sqlite3는 없는 파일을 조용히 새로 만들어 버리므로 먼저 막는다
            raise FileNotFoundError(f"사전 파일이 없습니다: {path}")
        # mode=ro: 게임 중에 사전이 바뀌는 일이 없도록 읽기 전용으로 연다.
        # check_same_thread=False: FastAPI가 요청을 여러 스레드에서 처리해도 읽기만 하므로 안전하다
        # resolve(): 상대 경로는 file URI로 바꿀 수 없다
        uri = f"{path.resolve().as_uri()}?mode=ro"
        self._con = sqlite3.connect(uri, uri=True, check_same_thread=False)

    def close(self) -> None:
        self._con.close()

    def contains(self, word: str) -> bool:
        row = self._con.execute("SELECT 1 FROM words WHERE word = ?", (word,)).fetchone()
        return row is not None

    def count_starting_with(self, first_char: str) -> int:
        row = self._con.execute(
            "SELECT COUNT(*) FROM words WHERE first_char = ?", (first_char,)
        ).fetchone()
        return int(row[0])

    def words_starting_with(self, first_char: str) -> list[str]:
        # ORDER BY가 있어야 시드를 고정했을 때 AI 결과가 재현된다
        rows = self._con.execute(
            "SELECT word FROM words WHERE first_char = ? ORDER BY word", (first_char,)
        )
        return [row[0] for row in rows]

    def definition(self, word: str) -> str | None:
        """결과 화면에 보여 줄 뜻풀이 (G-07). 사전에 없으면 None."""
        row = self._con.execute("SELECT definition FROM words WHERE word = ?", (word,)).fetchone()
        return row[0] if row else None
