"""
Constraint configuration endpoints.
Will be implemented in Phase 4.
"""

from fastapi import APIRouter

router = APIRouter(
    prefix="/constraints",
    tags=["Constraints"]
)


@router.get("/")
async def get_constraints():
    """Get current constraint configuration."""
    # TODO: Implement in Phase 4
    return {
        "message": "Constraint system not yet implemented",
        "phase": "Will be implemented in Phase 4"
    }


@router.put("/")
async def update_constraints():
    """Update constraint configuration."""
    # TODO: Implement in Phase 4
    return {
        "message": "Constraint updates not yet implemented",
        "phase": "Will be implemented in Phase 4"
    }