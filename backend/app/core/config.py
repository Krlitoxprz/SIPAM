from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "SIPAM-USCO"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True   # Sobreescribir con DEBUG=False en .env de producción

    SECRET_KEY: str = "sipam-usco-super-secret-key-2024-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # SQLite (desarrollo): sqlite:///./sipam_usco.db
    # PostgreSQL (producción): postgresql://user:pass@host:5432/sipam_db
    DATABASE_URL: str = "sqlite:///./sipam_usco.db"
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 10

    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    ADMIN_PASSWORD: str = "Sasuke24"  # Contraseña del superusuario admin — cambiar en .env
    ORS_API_KEY: str = ""  # OpenRouteService — gratuito en openrouteservice.org

    # SMTP — correo electrónico (SF-02, SF-10). Configura en .env para habilitar.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM: str = ""
    SMTP_TLS: bool = True

    # URL pública del frontend para links en emails
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
