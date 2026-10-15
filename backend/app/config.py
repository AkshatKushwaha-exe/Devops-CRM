from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://crm:crm_local_only@127.0.0.1:55433/crm"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
