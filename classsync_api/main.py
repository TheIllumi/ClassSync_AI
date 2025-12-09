"""
FastAPI application entry point for ClassSync AI.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from classsync_api.config import settings
from classsync_api.routers import health, datasets, constraints, scheduler


# Create FastAPI app instance
app = FastAPI(
    title=settings.app_name,
    description="AI-assisted university timetabling system",
    version=settings.version,
    debug=settings.debug
)


# Configure CORS
origins = settings.allowed_origins.split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(datasets.router, prefix=settings.api_prefix)
app.include_router(constraints.router, prefix=settings.api_prefix)
app.include_router(scheduler.router, prefix=settings.api_prefix)

@app.get("/")
async def root():
    """Root endpoint - API welcome message."""
    return {
        "message": f"Welcome to {settings.app_name} API",
        "version": settings.version,
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.version
    }


@app.get(f"{settings.api_prefix}/status")
async def api_status():
    """API status endpoint with configuration info (non-sensitive)."""
    return {
        "api_version": settings.version,
        "debug_mode": settings.debug,
        "max_upload_size_mb": settings.max_upload_size_mb,
        "max_optimization_time": settings.max_optimization_time_seconds,
        "database_configured": bool(settings.database_url != "postgresql://user:password@localhost:5432/classsync_db")
    }


# This will be used for running with uvicorn directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "classsync_api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )