"""환경 설정.

모든 설정값은 환경변수(.env)에서 읽고, 코드에 하드코딩하지 않는다.
pydantic-settings가 타입을 검증하므로 잘못된 값이면 서버가 시작 단계에서 바로 실패한다
(잘못된 설정으로 조용히 동작하는 것보다 낫다).
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# apps/api 폴더. 서버를 어느 폴더에서 실행해도 같은 .env와 사전 파일을 찾도록
# 실행 위치(cwd)가 아니라 이 파일의 위치를 기준으로 삼는다
API_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=API_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "말꼬리 API"
    version: str = "0.1.0"
    # 기본값을 False로 두어, .env를 빠뜨린 운영 환경에서도 안전한 쪽으로 동작하게 한다
    debug: bool = False
    cors_origins: list[str] = []
    # IP당 분당 요청 수 (429 RATE_LIMITED). 한 판에 1분당 많아야 20번 남짓 요청하므로 넉넉한 값.
    # 0이면 끈다(부하 테스트용)
    rate_limit_per_minute: int = 60
    # 동시에 메모리에 둘 수 있는 게임 수. 게임 생성을 쏟아부어 메모리를 채우는 공격을 막는다
    max_sessions: int = 10_000
    # 만드는 방법: uv run python -m scripts.build_dictionary
    dictionary_path: Path = API_DIR / "data" / "dictionary.sqlite"


@lru_cache
def get_settings() -> Settings:
    """설정 객체를 한 번만 만들어 재사용한다 (.env 파일을 요청마다 다시 읽지 않도록)."""
    return Settings()
