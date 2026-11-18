"""가공 사전에서 앱에 넣을 단어 목록(JSON)을 만든다.

앱이 서버 없이 혼자 판정·AI를 돌리므로 단어 목록을 앱 번들에 넣는다.
뜻풀이는 넣지 않는다: 전부 넣으면 앱이 25MB 늘어나지만 단어만이면 2.4MB다(결정 A안).
단어는 가나다순(코드 포인트 순)으로 저장한다 → 앱은 다시 정렬하지 않고 AI 결과가 재현된다.

실행: apps/api에서 `uv run python -m scripts.export_word_list`
"""

import json
import sqlite3
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
DB_PATH = API_DIR / "data" / "dictionary.sqlite"
OUT_PATH = API_DIR.parent / "mobile" / "src" / "features" / "game" / "data" / "words.json"

LICENSE_NOTE = (
    "국립국어원 표준국어대사전(https://stdict.korean.go.kr)의 자료를 가공함 "
    "(2글자 이상 명사 표제어만 추출). "
    "CC BY-SA 2.0 KR (https://creativecommons.org/licenses/by-sa/2.0/kr/)"
)


def export(db_path: Path, out_path: Path) -> int:
    """단어 수를 돌려준다."""
    if not db_path.is_file():
        raise FileNotFoundError(f"사전 파일이 없습니다(build_dictionary 먼저): {db_path.name}")
    con = sqlite3.connect(db_path)
    try:
        words = [row[0] for row in con.execute("SELECT word FROM words ORDER BY word")]
    finally:
        con.close()
    # 배열 대신 줄바꿈으로 이은 문자열 하나: JSON이 3.2MB → 2.4MB로 줄고,
    # 앱에서 split 한 번으로 읽는다
    data = {"license": LICENSE_NOTE, "count": len(words), "words": "\n".join(words)}
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return len(words)


if __name__ == "__main__":
    count = export(DB_PATH, OUT_PATH)
    print(f"단어 {count:,}개 → {OUT_PATH.relative_to(API_DIR.parent.parent)}")
