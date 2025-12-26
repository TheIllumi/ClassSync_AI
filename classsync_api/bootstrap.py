"""
Bootstrap utilities for initializing required database data.
"""

from sqlalchemy.orm import Session
from classsync_core.models import Institution


def ensure_default_institution(db: Session) -> None:
    """
    Ensure at least one institution exists in the database.

    This function is idempotent - it only creates a default institution
    if no institutions exist. Safe to call multiple times.

    Args:
        db: SQLAlchemy database session
    """
    # Check if any institution exists
    existing = db.query(Institution).first()

    if existing is not None:
        # Institution(s) already exist - do nothing
        return

    # No institutions exist - create a default one
    default_institution = Institution(
        name="Default Institution",
        code="DEFAULT",
        is_active=True
    )

    db.add(default_institution)
    db.commit()
