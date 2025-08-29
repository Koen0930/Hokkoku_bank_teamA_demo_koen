from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    line_channel_secret: str | None = None
    line_channel_access_token: str | None = None
    gemini_api_key: str | None = None

    app_host: str = "0.0.0.0"
    app_port: int = 8082
    app_reload: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
