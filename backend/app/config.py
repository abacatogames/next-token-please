from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:1b"
    default_difficulty: float = 1.0
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
    embeddings_top_k: int = 40
    distractor_weight_similarity: float = 0.55
    distractor_weight_context: float = 0.25
    distractor_weight_frequency: float = 0.20
    distractor_penalty_lemma: float = 0.40
    distractor_penalty_form: float = 0.15
    distractor_context_window: int = 8
    distractor_rank_window_pct: float = 0.10
    prompt_generation_enabled: bool = True
    prompt_generation_temperature: float = 0.95
    prompt_generation_top_p: float = 0.95
    prompt_generation_batch_size: int = 5
    prompt_store_size: int = 100
    prompt_store_idle_sleep: float = 2.0
    prompt_store_error_sleep: float = 10.0
    prompt_store_cache_path: str = "data/prompt_cache.json"
    prompt_store_prefer_generated_at: int = 20
    prompt_min_words: int = 4
    prompt_max_words: int = 20

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
