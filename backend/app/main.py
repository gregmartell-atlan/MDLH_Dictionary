"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.config import settings
from app.routers import connection_router, metadata_router, query_router

# Create FastAPI app
app = FastAPI(
    title="Snowflake Query API",
    description="Backend API for MDLH Dictionary Snowflake query execution",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",      # Vite dev server
        "http://localhost:3000",      # Alternative dev port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(connection_router)
app.include_router(metadata_router)
app.include_router(query_router)


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "Snowflake Query API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "connection": "/api/connect",
            "metadata": "/api/metadata/*",
            "query": "/api/query/*"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


def start():
    """Start the server programmatically."""
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )


if __name__ == "__main__":
    start()

