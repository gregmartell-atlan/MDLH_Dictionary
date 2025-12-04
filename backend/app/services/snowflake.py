"""Snowflake connection and query service."""

import snowflake.connector
from snowflake.connector import DictCursor
from typing import Optional, List, Dict, Any, Tuple
from contextlib import contextmanager
import os
from datetime import datetime
import uuid

from app.config import settings
from app.models.schemas import QueryStatus


class SnowflakeService:
    """Manages Snowflake connections and query execution."""
    
    def __init__(self):
        self._connection: Optional[snowflake.connector.SnowflakeConnection] = None
        self._query_results: Dict[str, Dict] = {}  # In-memory store for query results
    
    def _get_private_key(self) -> Optional[bytes]:
        """Load private key from file if configured."""
        if not settings.snowflake_private_key_path:
            return None
        
        key_path = settings.snowflake_private_key_path
        if not os.path.isabs(key_path):
            key_path = os.path.join(os.path.dirname(__file__), "..", "..", key_path)
        
        if not os.path.exists(key_path):
            return None
        
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.backends import default_backend
        
        with open(key_path, "rb") as key_file:
            private_key = serialization.load_pem_private_key(
                key_file.read(),
                password=None,
                backend=default_backend()
            )
        
        return private_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
    
    def connect(
        self,
        warehouse: Optional[str] = None,
        database: Optional[str] = None,
        schema: Optional[str] = None
    ) -> snowflake.connector.SnowflakeConnection:
        """Establish connection to Snowflake."""
        
        connect_params = {
            "account": settings.snowflake_account,
            "user": settings.snowflake_user,
            "warehouse": warehouse or settings.snowflake_warehouse,
            "database": database or settings.snowflake_database,
            "schema": schema or settings.snowflake_schema,
        }
        
        if settings.snowflake_role:
            connect_params["role"] = settings.snowflake_role
        
        # Try key-pair auth first, fall back to password
        private_key = self._get_private_key()
        if private_key:
            connect_params["private_key"] = private_key
        elif settings.snowflake_password:
            connect_params["password"] = settings.snowflake_password
        else:
            raise ValueError("No authentication method configured. Set SNOWFLAKE_PRIVATE_KEY_PATH or SNOWFLAKE_PASSWORD")
        
        self._connection = snowflake.connector.connect(**connect_params)
        return self._connection
    
    def is_connected(self) -> bool:
        """Check if there's an active connection."""
        if self._connection is None:
            return False
        try:
            # Try to check if connection is still alive
            # is_closed() is a method in newer versions, property in older
            is_closed = getattr(self._connection, 'is_closed', None)
            if callable(is_closed):
                return not is_closed()
            elif is_closed is not None:
                return not is_closed
            # Fallback: try a simple query
            return True
        except Exception:
            return False
    
    @contextmanager
    def get_cursor(self, dict_cursor: bool = True):
        """Get a database cursor with automatic cleanup."""
        if not self._connection:
            raise ValueError("No active Snowflake connection. Please connect first.")
        
        try:
            cursor_class = DictCursor if dict_cursor else None
            cursor = self._connection.cursor(cursor_class)
        except Exception as e:
            raise ValueError(f"Failed to create cursor: {str(e)}")
        
        try:
            yield cursor
        finally:
            try:
                cursor.close()
            except Exception:
                pass  # Ignore close errors
    
    def test_connection(self) -> Dict[str, Any]:
        """Test connection and return connection info."""
        try:
            conn = self.connect()
            with self.get_cursor() as cursor:
                cursor.execute("SELECT CURRENT_USER(), CURRENT_ACCOUNT(), CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_SCHEMA(), CURRENT_ROLE()")
                row = cursor.fetchone()
                return {
                    "connected": True,
                    "user": row["CURRENT_USER()"],
                    "account": row["CURRENT_ACCOUNT()"],
                    "warehouse": row["CURRENT_WAREHOUSE()"],
                    "database": row["CURRENT_DATABASE()"],
                    "schema": row["CURRENT_SCHEMA()"],
                    "role": row["CURRENT_ROLE()"],
                }
        except Exception as e:
            return {
                "connected": False,
                "error": str(e)
            }
    
    def connect_with_credentials(
        self,
        account: str,
        user: str,
        password: str,
        warehouse: Optional[str] = None,
        database: Optional[str] = None,
        schema: Optional[str] = None,
        role: Optional[str] = None
    ) -> Dict[str, Any]:
        """Connect with explicitly provided credentials (from UI)."""
        try:
            connect_params = {
                "account": account,
                "user": user,
                "password": password,
                "warehouse": warehouse or "COMPUTE_WH",
                "database": database or "ATLAN_MDLH",
                "schema": schema or "PUBLIC",
            }
            
            if role:
                connect_params["role"] = role
            
            self._connection = snowflake.connector.connect(**connect_params)
            
            with self.get_cursor() as cursor:
                cursor.execute("SELECT CURRENT_USER(), CURRENT_ACCOUNT(), CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_SCHEMA(), CURRENT_ROLE()")
                row = cursor.fetchone()
                return {
                    "connected": True,
                    "user": row["CURRENT_USER()"],
                    "account": row["CURRENT_ACCOUNT()"],
                    "warehouse": row["CURRENT_WAREHOUSE()"],
                    "database": row["CURRENT_DATABASE()"],
                    "schema": row["CURRENT_SCHEMA()"],
                    "role": row["CURRENT_ROLE()"],
                }
        except Exception as e:
            return {
                "connected": False,
                "error": str(e)
            }
    
    def connect_with_token(
        self,
        account: str,
        user: str,
        token: str,
        warehouse: Optional[str] = None,
        database: Optional[str] = None,
        schema: Optional[str] = None,
        role: Optional[str] = None
    ) -> Dict[str, Any]:
        """Connect using a Personal Access Token (PAT) or programmatic token."""
        
        base_params = {
            "account": account,
            "user": user,
            "warehouse": warehouse or "COMPUTE_WH",
            "database": database or "ATLAN_MDLH", 
            "schema": schema or "PUBLIC",
        }
        if role:
            base_params["role"] = role
        
        # Try different authentication methods for tokens
        auth_attempts = [
            # Method 1: Programmatic Access Token (Snowflake's recommended for PAT)
            {"token": token, "authenticator": "programmatic_access_token"},
            # Method 2: OAuth 
            {"token": token, "authenticator": "oauth"},
            # Method 3: Use token as password
            {"password": token},
            # Method 4: External browser OAuth (won't work headless but try)
            {"authenticator": "externalbrowser"},
        ]
        
        errors = []
        
        for auth_params in auth_attempts:
            try:
                connect_params = {**base_params, **auth_params}
                self._connection = snowflake.connector.connect(**connect_params)
                
                with self.get_cursor() as cursor:
                    cursor.execute("SELECT CURRENT_USER(), CURRENT_ACCOUNT(), CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_SCHEMA(), CURRENT_ROLE()")
                    row = cursor.fetchone()
                    return {
                        "connected": True,
                        "user": row["CURRENT_USER()"],
                        "account": row["CURRENT_ACCOUNT()"],
                        "warehouse": row["CURRENT_WAREHOUSE()"],
                        "database": row["CURRENT_DATABASE()"],
                        "schema": row["CURRENT_SCHEMA()"],
                        "role": row["CURRENT_ROLE()"],
                    }
            except Exception as e:
                error_msg = str(e)
                # Skip logging duplicate errors
                if error_msg not in errors:
                    errors.append(error_msg)
                continue
        
        # Provide helpful error message
        error_summary = errors[0] if errors else "Unknown error"
        return {
            "connected": False,
            "error": f"Token authentication failed. Your PAT may have expired or lacks permissions. Error: {error_summary}"
        }
    
    def connect_with_sso(
        self,
        account: str,
        user: str,
        warehouse: Optional[str] = None,
        database: Optional[str] = None,
        schema: Optional[str] = None,
        role: Optional[str] = None
    ) -> Dict[str, Any]:
        """Connect using external browser (SSO/Okta) authentication."""
        try:
            connect_params = {
                "account": account,
                "user": user,
                "authenticator": "externalbrowser",
                "warehouse": warehouse or "COMPUTE_WH",
                "database": database or "ATLAN_MDLH",
                "schema": schema or "PUBLIC",
            }
            
            if role:
                connect_params["role"] = role
            
            # This will open a browser for SSO login
            self._connection = snowflake.connector.connect(**connect_params)
            
            with self.get_cursor() as cursor:
                cursor.execute("SELECT CURRENT_USER(), CURRENT_ACCOUNT(), CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_SCHEMA(), CURRENT_ROLE()")
                row = cursor.fetchone()
                return {
                    "connected": True,
                    "user": row["CURRENT_USER()"],
                    "account": row["CURRENT_ACCOUNT()"],
                    "warehouse": row["CURRENT_WAREHOUSE()"],
                    "database": row["CURRENT_DATABASE()"],
                    "schema": row["CURRENT_SCHEMA()"],
                    "role": row["CURRENT_ROLE()"],
                }
        except Exception as e:
            return {
                "connected": False,
                "error": f"SSO authentication failed. Make sure you complete the login in the browser window. Error: {str(e)}"
            }
    
    def disconnect(self):
        """Close the connection."""
        if self._connection:
            self._connection.close()
            self._connection = None
    
    # ============ Metadata Methods ============
    
    def get_databases(self) -> List[Dict[str, Any]]:
        """Get list of all databases."""
        with self.get_cursor() as cursor:
            cursor.execute("SHOW DATABASES")
            results = cursor.fetchall()
            return [
                {
                    "name": row["name"],
                    "created_on": row.get("created_on"),
                    "owner": row.get("owner")
                }
                for row in results
            ]
    
    def get_schemas(self, database: str) -> List[Dict[str, Any]]:
        """Get list of schemas in a database."""
        with self.get_cursor() as cursor:
            cursor.execute(f"SHOW SCHEMAS IN DATABASE {database}")
            results = cursor.fetchall()
            return [
                {
                    "name": row["name"],
                    "database_name": database,
                    "created_on": row.get("created_on"),
                    "owner": row.get("owner")
                }
                for row in results
            ]
    
    def get_tables(self, database: str, schema: str) -> List[Dict[str, Any]]:
        """Get list of tables and views in a schema."""
        tables = []
        with self.get_cursor() as cursor:
            # Get tables
            cursor.execute(f"SHOW TABLES IN SCHEMA {database}.{schema}")
            for row in cursor.fetchall():
                tables.append({
                    "name": row["name"],
                    "database_name": database,
                    "schema_name": schema,
                    "kind": "TABLE",
                    "rows": row.get("rows"),
                    "created_on": row.get("created_on"),
                    "owner": row.get("owner")
                })
            
            # Get views
            cursor.execute(f"SHOW VIEWS IN SCHEMA {database}.{schema}")
            for row in cursor.fetchall():
                tables.append({
                    "name": row["name"],
                    "database_name": database,
                    "schema_name": schema,
                    "kind": "VIEW",
                    "rows": None,
                    "created_on": row.get("created_on"),
                    "owner": row.get("owner")
                })
        
        return sorted(tables, key=lambda x: x["name"])
    
    def get_columns(self, database: str, schema: str, table: str) -> List[Dict[str, Any]]:
        """Get column metadata for a table."""
        with self.get_cursor() as cursor:
            cursor.execute(f"DESCRIBE TABLE {database}.{schema}.{table}")
            results = cursor.fetchall()
            return [
                {
                    "name": row["name"],
                    "data_type": row["type"],
                    "nullable": row.get("null?", "Y") == "Y",
                    "default": row.get("default"),
                    "primary_key": row.get("primary key", "N") == "Y",
                    "comment": row.get("comment")
                }
                for row in results
            ]
    
    # ============ Query Execution Methods ============
    
    def execute_query(
        self,
        sql: str,
        database: Optional[str] = None,
        schema: Optional[str] = None,
        warehouse: Optional[str] = None,
        timeout: int = 60,
        limit: Optional[int] = None
    ) -> str:
        """Execute a query and return query_id."""
        query_id = str(uuid.uuid4())
        
        # Store initial status
        self._query_results[query_id] = {
            "status": QueryStatus.RUNNING,
            "sql": sql,
            "database": database,
            "schema": schema,
            "warehouse": warehouse,
            "started_at": datetime.utcnow(),
            "completed_at": None,
            "row_count": None,
            "columns": [],
            "rows": [],
            "error_message": None
        }
        
        # Check connection first
        if not self._connection:
            self._query_results[query_id].update({
                "status": QueryStatus.FAILED,
                "completed_at": datetime.utcnow(),
                "error_message": "No active Snowflake connection. Please connect first."
            })
            return query_id
        
        try:
            # Set context if specified - use standard cursor for consistent row format
            with self.get_cursor(dict_cursor=False) as cursor:
                if warehouse:
                    cursor.execute(f"USE WAREHOUSE {warehouse}")
                if database:
                    cursor.execute(f"USE DATABASE {database}")
                if schema:
                    cursor.execute(f"USE SCHEMA {schema}")
                
                # Execute the query
                cursor.execute(sql, timeout=timeout)
                
                # Get column metadata
                columns = []
                if cursor.description:
                    columns = [
                        {"name": col[0], "type": str(col[1]) if col[1] else "unknown"}
                        for col in cursor.description
                    ]
                
                # Fetch results (with optional limit)
                if limit:
                    rows = cursor.fetchmany(limit)
                else:
                    rows = cursor.fetchall()
                
                # Convert rows to serializable lists
                processed_rows = []
                for row in rows:
                    processed_row = []
                    for val in row:
                        # Handle special types
                        if val is None:
                            processed_row.append(None)
                        elif isinstance(val, (datetime,)):
                            processed_row.append(val.isoformat())
                        elif isinstance(val, bytes):
                            processed_row.append(val.decode('utf-8', errors='replace'))
                        else:
                            processed_row.append(val)
                    processed_rows.append(processed_row)
                
                # Update stored results
                self._query_results[query_id].update({
                    "status": QueryStatus.SUCCESS,
                    "completed_at": datetime.utcnow(),
                    "row_count": len(processed_rows),
                    "columns": columns,
                    "rows": processed_rows
                })
                
        except Exception as e:
            self._query_results[query_id].update({
                "status": QueryStatus.FAILED,
                "completed_at": datetime.utcnow(),
                "error_message": str(e)
            })
        
        return query_id
    
    def get_query_status(self, query_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a query."""
        result = self._query_results.get(query_id)
        if not result:
            return None
        
        duration_ms = None
        if result["started_at"] and result["completed_at"]:
            duration_ms = int((result["completed_at"] - result["started_at"]).total_seconds() * 1000)
        
        return {
            "query_id": query_id,
            "status": result["status"],
            "row_count": result["row_count"],
            "execution_time_ms": duration_ms,
            "error_message": result["error_message"],
            "started_at": result["started_at"],
            "completed_at": result["completed_at"]
        }
    
    def get_query_results(
        self,
        query_id: str,
        page: int = 1,
        page_size: int = 100
    ) -> Optional[Dict[str, Any]]:
        """Get paginated results for a query."""
        result = self._query_results.get(query_id)
        if not result or result["status"] != QueryStatus.SUCCESS:
            return None
        
        total_rows = len(result["rows"])
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        return {
            "query_id": query_id,
            "columns": result["columns"],
            "rows": result["rows"][start_idx:end_idx],
            "total_rows": total_rows,
            "page": page,
            "page_size": page_size,
            "has_more": end_idx < total_rows
        }
    
    def cancel_query(self, query_id: str) -> bool:
        """Cancel a running query."""
        result = self._query_results.get(query_id)
        if result and result["status"] == QueryStatus.RUNNING:
            result["status"] = QueryStatus.CANCELLED
            result["completed_at"] = datetime.utcnow()
            return True
        return False


# Global service instance
snowflake_service = SnowflakeService()

