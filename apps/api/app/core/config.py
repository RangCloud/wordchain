"""환경 설정.

모든 설정값은 환경변수(.env)에서 읽고, 코드에 하드코딩하지 않는다.
pydantic-settings가 타입을 검증하므로 잘못된 값이면 서버가 시작 단계에서 바로 실패한다
(잘못된 설정으로 조용히 동작하는 것보다 낫다).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "말꼬리 API"
    version: str = "0.1.0"
    # 기본값을 False로 두어, .env를 빠뜨린 운영 환경에서도 안전한 쪽으로 동작하게 한다
    debug: bool = False
    cors_origins: list[str] = []


@lru_cache
def get_settings() -> Settings:
    """설정 객체를 한 번만 만들어 재사용한다 (.env 파일을 요청마다 다시 읽지 않도록)."""
    return Settings()
