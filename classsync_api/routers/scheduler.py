"""
Timetable generation and scheduling endpoints.
Will be implemented in Phase 5.
"""

from fastapi import APIRouter, HTTPException

router = APIRouter(
    prefix="/scheduler",
    tags=["Scheduler"]
)


@router.post("/generate")
async def generate_timetable():
    """Generate a new timetable."""
    # TODO: Implement in Phase 5
    raise HTTPException(
        status_code=501,
        detail="Timetable generation not yet implemented. Coming in Phase 5."
    )


@router.get("/status/{job_id}")
async def get_generation_status(job_id: str):
    """Get status of a timetable generation job."""
    # TODO: Implement in Phase 5
    return {
        "job_id": job_id,
        "status": "not_implemented",
        "phase": "Will be implemented in Phase 5"
    }