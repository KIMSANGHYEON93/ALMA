from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://alma:alma@localhost:5432/alma"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/integrations/google/callback"
    encryption_key: str = ""
    telegram_bot_token: str = ""
    telegram_allowed_users: str = ""  # comma-separated telegram user IDs
    discord_bot_token: str = ""
    discord_allowed_guilds: str = ""  # comma-separated guild IDs
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_email: str = "mailto:admin@alma.dev"

    # Ontology settings
    ontology_dedup_auto_merge_threshold: float = 0.98
    ontology_dedup_review_threshold: float = 0.92
    ontology_confidence_auto_verify: float = 0.8
    ontology_confidence_reject: float = 0.5
    ontology_chat_min_length: int = 30

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
