"""
Timetable generation and scheduling endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from classsync_api.database import get_db
from classsync_api.dependencies import get_institution_id
from classsync_api.schemas import MessageResponse
from classsync_core.models import Timetable, ConstraintConfig, TimetableEntry
from classsync_core.optimizer import TimetableOptimizer

router = APIRouter(
    prefix="/scheduler",
    tags=["Scheduler"]
)


@router.post("/generate")
async def generate_timetable(
    constraint_config_id: Optional[int] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    institution_id: str = Depends(get_institution_id)
):
    """
    Generate a new timetable.

    Args:
        constraint_config_id: ID of constraint configuration to use (uses default if not provided)

    Returns:
        Job information with timetable_id once generation starts
    """

    # Get constraint config
    if constraint_config_id:
        config = db.query(ConstraintConfig).filter(
            ConstraintConfig.id == constraint_config_id,
            ConstraintConfig.institution_id == 1
        ).first()

        if not config:
            raise HTTPException(status_code=404, detail="Constraint configuration not found")
    else:
        # Use default config
        config = db.query(ConstraintConfig).filter(
            ConstraintConfig.institution_id == 1,
            ConstraintConfig.is_default == True
        ).first()

        if not config:
            raise HTTPException(status_code=404, detail="No default constraint configuration found")

    # Initialize optimizer
    optimizer = TimetableOptimizer(config)

    # Generate timetable (synchronous for now, will be async in Phase 5B)
    result = optimizer.generate_timetable(
        db=db,
        institution_id=1,
        population_size=30,
        generations=100
    )

    if not result['success']:
        raise HTTPException(status_code=500, detail=result.get('error', 'Generation failed'))

    return {
        "message": "Timetable generated successfully",
        "timetable_id": result['timetable_id'],
        "generation_time": result['generation_time'],
        "sessions_scheduled": result['sessions_scheduled'],
        "sessions_total": result['sessions_total'],
        "fitness_score": result['fitness_score']
    }


@router.get("/timetables")
async def list_timetables(
    limit: int = 20,
    db: Session = Depends(get_db),
    institution_id: str = Depends(get_institution_id)
):
    """List all generated timetables for the institution."""

    timetables = db.query(Timetable).filter(
        Timetable.institution_id == 1
    ).order_by(Timetable.created_at.desc()).limit(limit).all()

    return [
        {
            "id": t.id,
            "name": t.name,
            "semester": t.semester,
            "year": t.year,
            "status": t.status,
            "generation_time_seconds": t.generation_time_seconds,
            "constraint_score": t.constraint_score,
            "conflict_count": t.conflict_count,
            "created_at": t.created_at
        }
        for t in timetables
    ]


@router.get("/timetables/{timetable_id}")
async def get_timetable(
    timetable_id: int,
    db: Session = Depends(get_db),
    institution_id: str = Depends(get_institution_id)
):
    """Get details of a specific timetable."""

    timetable = db.query(Timetable).filter(
        Timetable.id == timetable_id,
        Timetable.institution_id == 1
    ).first()

    if not timetable:
        raise HTTPException(status_code=404, detail="Timetable not found")

    # Get entries
    entries = db.query(TimetableEntry).filter(
        TimetableEntry.timetable_id == timetable_id
    ).all()

    return {
        "id": timetable.id,
        "name": timetable.name,
        "semester": timetable.semester,
        "year": timetable.year,
        "status": timetable.status,
        "generation_time_seconds": timetable.generation_time_seconds,
        "constraint_score": timetable.constraint_score,
        "conflict_count": timetable.conflict_count,
        "created_at": timetable.created_at,
        "entry_count": len(entries),
        "entries": [
            {
                "day_of_week": e.day_of_week,
                "start_time": e.start_time,
                "end_time": e.end_time,
                "section_id": e.section_id,
                "course_id": e.course_id,
                "teacher_id": e.teacher_id,
                "room_id": e.room_id
            }
            for e in entries[:100]  # Limit for performance
        ]
    }


@router.delete("/timetables/{timetable_id}", response_model=MessageResponse)
async def delete_timetable(
    timetable_id: int,
    db: Session = Depends(get_db),
    institution_id: str = Depends(get_institution_id)
):
    """Delete a generated timetable."""

    timetable = db.query(Timetable).filter(
        Timetable.id == timetable_id,
        Timetable.institution_id == 1
    ).first()

    if not timetable:
        raise HTTPException(status_code=404, detail="Timetable not found")

    db.delete(timetable)  # Cascade will delete entries
    db.commit()

    return MessageResponse(
        message="Timetable deleted successfully",
        details={"timetable_id": timetable_id}
    )