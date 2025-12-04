"""Application configuration from environment variables."""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Snowflake and server configuration."""
    
    # Snowflake Connection
    snowflake_account: str = ""
    snowflake_user: str = ""
    snowflake_private_key_path: Optional[str] = None
    snowflake_password: Optional[str] = None
    snowflake_warehouse: str = "COMPUTE_WH"
    snowflake_database: str = "ATLAN_MDLH"
    snowflake_schema: str = "PUBLIC"
    snowflake_role: Optional[str] = None
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    
    # Cache TTLs (seconds)
    cache_ttl_databases: int = 300  # 5 minutes
    cache_ttl_schemas: int = 300    # 5 minutes
    cache_ttl_tables: int = 120     # 2 minutes
    cache_ttl_columns: int = 600    # 10 minutes
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

