from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:1b"
    default_difficulty: float = 0.5
    cors_origins: str = "http://localhost:5173"
    choice_target: int = 15
    opening_reveal: int = 3
    log_level: str = "INFO"
    round_pool_enabled: bool = True
    round_pool_size: int = 3
    round_pool_idle_sleep: float = 0.5
    round_pool_error_sleep: float = 5.0
    embeddings_enabled: bool = True
    embeddings_model: str = "glove-wiki-gigaword-100"
    embeddings_pool_size: int = 5000
    embeddings_top_k: int = 20

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
