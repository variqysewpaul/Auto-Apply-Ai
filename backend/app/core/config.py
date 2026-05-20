import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "AutoApply SaaS Backend"
    API_V1_STR: str = "/api/v1"
    
    # JWT security settings
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super_secret_local_dev_key_change_in_production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    
    # Database configuration
    # Falls back to local SQLite database in backend directory for development,
    # allows drop-in PostgreSQL migration in production via env configuration.
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./backend_apps.db")

settings = Settings()
