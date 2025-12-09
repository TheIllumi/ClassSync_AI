"""
Dataset upload and management endpoints.
Will be implemented in Phase 3.
"""

from fastapi import APIRouter, HTTPException

router = APIRouter(
    prefix="/datasets",
    tags=["Datasets"]
)


@router.get("/")
async def list_datasets():
    """List all datasets for the institution."""
    # TODO: Implement in Phase 3
    return {
        "message": "Dataset listing not yet implemented",
        "phase": "Will be implemented in Phase 3"
    }


@router.post("/upload")
async def upload_dataset():
    """Upload a new dataset (CSV/XLSX)."""
    # TODO: Implement in Phase 3
    raise HTTPException(
        status_code=501,
        detail="Dataset upload not yet implemented. Coming in Phase 3."
    )