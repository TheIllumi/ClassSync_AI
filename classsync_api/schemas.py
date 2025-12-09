"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ============================================================================
# ENUMS (matching database enums)
# ============================================================================

class UserRoleSchema(str, Enum):
    ADMIN = "admin"
    COORDINATOR = "coordinator"
    VIEWER = "viewer"


class DatasetStatusSchema(str, Enum):
    PENDING = "pending"
    VALIDATED = "validated"
    INVALID = "invalid"
    PROCESSING = "processing"


class DatasetTypeSchema(str, Enum):
    COURSES = "courses"
    TEACHERS = "teachers"
    ROOMS = "rooms"
    SECTIONS = "sections"


# ============================================================================
# DATASET SCHEMAS
# ============================================================================

class DatasetUploadResponse(BaseModel):
    """Response after uploading a dataset."""
    id: int
    filename: str
    file_type: str
    status: DatasetStatusSchema
    s3_key: str
    row_count: Optional[int] = None
    validation_errors: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DatasetListItem(BaseModel):
    """Dataset item in list view."""
    id: int
    filename: str
    file_type: str
    status: DatasetStatusSchema
    row_count: Optional[int]
    created_at: datetime
    uploaded_by: Optional[int]

    class Config:
        from_attributes = True


class DatasetValidationError(BaseModel):
    """Validation error details."""
    row: Optional[int] = None
    column: Optional[str] = None
    error_type: str
    message: str
    suggestion: Optional[str] = None


class DatasetValidationResult(BaseModel):
    """Complete validation result."""
    is_valid: bool
    total_rows: int
    valid_rows: int
    invalid_rows: int
    errors: List[DatasetValidationError]
    warnings: Optional[List[str]] = []


# ============================================================================
# COURSE DATASET SCHEMA
# ============================================================================

class CourseDataRow(BaseModel):
    """Expected structure for course CSV/XLSX rows."""
    course_code: str = Field(..., min_length=1, max_length=50)
    course_name: str = Field(..., min_length=1, max_length=255)
    teacher_code: str = Field(..., min_length=1, max_length=50)
    course_type: str = Field(default="lecture")  # lecture, lab, tutorial
    credit_hours: int = Field(default=3, ge=1, le=6)
    duration_minutes: int = Field(default=60, ge=30, le=240)
    sessions_per_week: int = Field(default=1, ge=1, le=7)

    @validator('course_type')
    def validate_course_type(cls, v):
        valid_types = ['lecture', 'lab', 'tutorial']
        if v.lower() not in valid_types:
            raise ValueError(f"course_type must be one of: {', '.join(valid_types)}")
        return v.lower()


# ============================================================================
# TEACHER DATASET SCHEMA
# ============================================================================

class TeacherDataRow(BaseModel):
    """Expected structure for teacher CSV/XLSX rows."""
    teacher_code: str = Field(..., min_length=1, max_length=50)
    teacher_name: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    department: Optional[str] = Field(None, max_length=100)


# ============================================================================
# ROOM DATASET SCHEMA
# ============================================================================

class RoomDataRow(BaseModel):
    """Expected structure for room CSV/XLSX rows."""
    room_code: str = Field(..., min_length=1, max_length=50)
    room_name: Optional[str] = Field(None, max_length=255)
    room_type: str = Field(default="lecture_hall")
    capacity: int = Field(default=50, ge=1)
    building: Optional[str] = Field(None, max_length=100)
    floor: Optional[str] = Field(None, max_length=20)

    @validator('room_type')
    def validate_room_type(cls, v):
        valid_types = ['lecture_hall', 'lab', 'tutorial_room', 'seminar_room']
        if v.lower() not in valid_types:
            raise ValueError(f"room_type must be one of: {', '.join(valid_types)}")
        return v.lower()


# ============================================================================
# SECTION DATASET SCHEMA
# ============================================================================

class SectionDataRow(BaseModel):
    """Expected structure for section CSV/XLSX rows."""
    section_code: str = Field(..., min_length=1, max_length=50)
    section_name: Optional[str] = Field(None, max_length=255)
    course_code: str = Field(..., min_length=1, max_length=50)
    semester: str = Field(..., max_length=50)
    year: int = Field(..., ge=2020, le=2030)
    student_count: int = Field(default=30, ge=1, le=500)


# ============================================================================
# GENERAL RESPONSE SCHEMAS
# ============================================================================

class MessageResponse(BaseModel):
    """Generic message response."""
    message: str
    details: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    """Error response."""
    error: str
    details: Optional[str] = None