"""
Caching service for metadata and query results.

Like Snowflake's result cache:
- Identical queries return cached results instantly
- TTL-based expiration (5 minutes default)
- LRU eviction when cache is full
"""

from cachetools import TTLCache, LRUCache
from typing import Any, Optional, Callable, Dict
from functools import wraps
from datetime import datetime
import hashlib
import json
import threading

from app.config import settings


class QueryResultCache:
    """
    Query result cache - like Snowflake's result cache.

    - Caches query results by SQL hash
    - 5 minute TTL (configurable)
    - Thread-safe
    - Max 1000 cached queries
    """

    def __init__(self, maxsize: int = 1000, ttl: int = 300):
        self._cache = TTLCache(maxsize=maxsize, ttl=ttl)
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0

    def _make_key(self, sql: str, database: str = None, schema: str = None) -> str:
        """Create cache key from SQL and context."""
        # Normalize SQL (strip whitespace, lowercase for consistency)
        normalized_sql = ' '.join(sql.strip().split()).lower()
        key_data = {
            'sql': normalized_sql,
            'database': database,
            'schema': schema
        }
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.sha256(key_str.encode()).hexdigest()

    def get(self, sql: str, database: str = None, schema: str = None) -> Optional[Dict]:
        """Get cached result for query."""
        key = self._make_key(sql, database, schema)
        with self._lock:
            result = self._cache.get(key)
            if result is not None:
                self._hits += 1
                return result
            self._misses += 1
            return None

    def set(self, sql: str, result: Dict, database: str = None, schema: str = None) -> None:
        """Cache a query result."""
        key = self._make_key(sql, database, schema)
        with self._lock:
            # Don't cache very large results (> 5MB estimated)
            if len(json.dumps(result)) > 5 * 1024 * 1024:
                return
            self._cache[key] = {
                **result,
                '_cached_at': datetime.utcnow().isoformat(),
                '_from_cache': True
            }

    def invalidate(self, sql: str = None, database: str = None, schema: str = None) -> None:
        """Invalidate cache entries."""
        with self._lock:
            if sql:
                key = self._make_key(sql, database, schema)
                self._cache.pop(key, None)
            else:
                self._cache.clear()

    def stats(self) -> Dict[str, Any]:
        """Return cache statistics."""
        with self._lock:
            total = self._hits + self._misses
            hit_rate = (self._hits / total * 100) if total > 0 else 0
            return {
                'size': len(self._cache),
                'maxsize': self._cache.maxsize,
                'hits': self._hits,
                'misses': self._misses,
                'hit_rate': f'{hit_rate:.1f}%',
                'ttl_seconds': self._cache.ttl
            }

    def clear(self) -> None:
        """Clear all cached results."""
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0


# Global query result cache
query_cache = QueryResultCache(maxsize=1000, ttl=300)


class MetadataCache:
    """TTL-based cache for Snowflake metadata."""
    
    def __init__(self):
        self._lock = threading.RLock()
        # Separate caches for different data types with different TTLs
        self._databases = TTLCache(maxsize=100, ttl=settings.cache_ttl_databases)
        self._schemas = TTLCache(maxsize=1000, ttl=settings.cache_ttl_schemas)
        self._tables = TTLCache(maxsize=5000, ttl=settings.cache_ttl_tables)
        self._columns = TTLCache(maxsize=10000, ttl=settings.cache_ttl_columns)
        self._capabilities = TTLCache(maxsize=1000, ttl=settings.cache_ttl_tables)
    
    def _make_key(self, *args) -> str:
        """Create a cache key from arguments."""
        key_str = json.dumps(args, sort_keys=True, default=str)
        return hashlib.md5(key_str.encode()).hexdigest()

    def _scoped_key(self, scope: Optional[str], *args) -> str:
        """Create a cache key including scope to avoid cross-tenant leaks."""
        if scope:
            return self._make_key(scope, *args)
        return self._make_key(*args)
    
    # Database cache
    def get_databases(self, scope: Optional[str] = None) -> Optional[Any]:
        with self._lock:
            return self._databases.get(scope or "all")
    
    def set_databases(self, data: Any, scope: Optional[str] = None):
        with self._lock:
            self._databases[scope or "all"] = data
    
    def clear_databases(self):
        with self._lock:
            self._databases.clear()
    
    # Schema cache
    def get_schemas(self, database: str, scope: Optional[str] = None) -> Optional[Any]:
        with self._lock:
            key = self._scoped_key(scope, database)
            return self._schemas.get(key)
    
    def set_schemas(self, database: str, data: Any, scope: Optional[str] = None):
        with self._lock:
            key = self._scoped_key(scope, database)
            self._schemas[key] = data
    
    def clear_schemas(self, database: Optional[str] = None, scope: Optional[str] = None):
        with self._lock:
            if database:
                key = self._scoped_key(scope, database)
                self._schemas.pop(key, None)
            else:
                self._schemas.clear()
    
    # Table cache
    def get_tables(self, database: str, schema: str, scope: Optional[str] = None) -> Optional[Any]:
        key = self._scoped_key(scope, database, schema)
        with self._lock:
            return self._tables.get(key)
    
    def set_tables(self, database: str, schema: str, data: Any, scope: Optional[str] = None):
        key = self._scoped_key(scope, database, schema)
        with self._lock:
            self._tables[key] = data
    
    def clear_tables(self, database: Optional[str] = None, schema: Optional[str] = None, scope: Optional[str] = None):
        with self._lock:
            if database and schema:
                key = self._scoped_key(scope, database, schema)
                self._tables.pop(key, None)
            else:
                self._tables.clear()
    
    # Column cache
    def get_columns(self, database: str, schema: str, table: str, scope: Optional[str] = None) -> Optional[Any]:
        key = self._scoped_key(scope, database, schema, table)
        with self._lock:
            return self._columns.get(key)
    
    def set_columns(self, database: str, schema: str, table: str, data: Any, scope: Optional[str] = None):
        key = self._scoped_key(scope, database, schema, table)
        with self._lock:
            self._columns[key] = data
    
    def clear_columns(self, database: Optional[str] = None, schema: Optional[str] = None, table: Optional[str] = None, scope: Optional[str] = None):
        with self._lock:
            if database and schema and table:
                key = self._scoped_key(scope, database, schema, table)
                self._columns.pop(key, None)
            else:
                self._columns.clear()
    
    def clear_all(self):
        """Clear all caches."""
        with self._lock:
            self._databases.clear()
            self._schemas.clear()
            self._tables.clear()
            self._columns.clear()
            self._capabilities.clear()

    # Capabilities cache
    def get_capabilities(self, database: str, schema: str, scope: Optional[str] = None) -> Optional[Any]:
        key = self._scoped_key(scope, database, schema)
        with self._lock:
            return self._capabilities.get(key)

    def set_capabilities(self, database: str, schema: str, data: Any, scope: Optional[str] = None):
        key = self._scoped_key(scope, database, schema)
        with self._lock:
            self._capabilities[key] = data

    def clear_capabilities(self, database: Optional[str] = None, schema: Optional[str] = None, scope: Optional[str] = None):
        with self._lock:
            if database and schema:
                key = self._scoped_key(scope, database, schema)
                self._capabilities.pop(key, None)
            else:
                self._capabilities.clear()


# Global cache instance
metadata_cache = MetadataCache()
