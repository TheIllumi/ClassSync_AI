"""
Dataset upload and management endpoints.
"""

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import tempfile
import os

from classsync_api.database import get_db
from classsync_api.dependencies import get_institution_id, get_current_user
from classsync_api.schemas import (
    DatasetUploadResponse, DatasetListItem, MessageResponse,
    DatasetValidationResult, DatasetTypeSchema, DatasetStatusSchema
)
from classsync_core.models import Dataset, User
from classsync_core.storage import s3_service
from classsync_core.validators import DatasetValidator
from classsync_core.models import DatasetStatus

router = APIRouter(
    prefix="/datasets",
    tags=["Datasets"]
)

@router.post("/upload", response_model=DatasetUploadResponse)
async def upload_dataset(
        file: UploadFile = File(...),
        dataset_type: DatasetTypeSchema = Query(...,
                                                description="Type of dataset: courses, teachers, rooms, or sections"),
        db: Session = Depends(get_db),
        institution_id: str = Depends(get_institution_id),
        current_user: dict = Depends(get_current_user)
):
    """
    Upload a dataset file (CSV or XLSX).

    Steps:
    1. Validate file type
    2. Save temporarily
    3. Validate file structure and content
    4. Upload to S3
    5. Save metadata to database
    """

    # Validate file extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    file_ext = file.filename.lower().split('.')[-1]
    if file_ext not in ['csv', 'xlsx', 'xls']:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only CSV and XLSX files are accepted."
        )

    # Read file content
    try:
        file_content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    # Save to temporary file for validation
    temp_file_path = None
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_ext}') as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name

        # Validate file
        validator = DatasetValidator(dataset_type.value)
        validation_result = validator.validate_file(temp_file_path)

        # Determine status based on validation - USE LOWERCASE STRING DIRECTLY
        status_value = "VALIDATED" if validation_result.is_valid else "INVALID"

        # Generate S3 key
        s3_key = s3_service.generate_s3_key(
            institution_id=1,  # Hardcoded for now
            filename=file.filename,
            dataset_type=dataset_type.value
        )

        # Upload to S3
        content_type = 'text/csv' if file_ext == 'csv' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        upload_success = s3_service.upload_file(
            file_content=file_content,
            s3_key=s3_key,
            content_type=content_type
        )

        if not upload_success:
            raise HTTPException(status_code=500, detail="Failed to upload file to storage")

        # Save metadata to database
        dataset = Dataset(
            institution_id=1,
            filename=file.filename,
            file_type=file_ext,
            s3_key=s3_key,
            status=status_value,  # Pass the lowercase string directly
            validation_errors=validation_result.model_dump() if not validation_result.is_valid else None,
            row_count=validation_result.total_rows,
            uploaded_by=1
        )

        db.add(dataset)
        db.commit()
        db.refresh(dataset)

        return DatasetUploadResponse(
            id=dataset.id,
            filename=dataset.filename,
            file_type=dataset.file_type,
            status=DatasetStatusSchema(dataset.status),
            s3_key=dataset.s3_key,
            row_count=dataset.row_count,
            validation_errors=dataset.validation_errors,
            created_at=dataset.created_at
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except:
                pass


@router.get("/", response_model=List[DatasetListItem])
async def list_datasets(
    dataset_type: Optional[DatasetTypeSchema] = Query(None, description="Filter by dataset type"),
    status: Optional[DatasetStatusSchema] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Number of results to return"),
    db: Session = Depends(get_db),
    institution_id: str = Depends(get_institution_id)
):
    """
    List all datasets for the institution.

    Optional filters:
    - dataset_type: courses, teachers, rooms, sections
    - status: pending, validated, invalid, processing
    """

    # Build query
    query = db.query(Dataset).filter(
        Dataset.institution_id == 1  # TODO: Use actual institution_id in Phase 9
    )

    # Apply filters
    # Note: We don't have dataset_type column yet, will add in future if needed

    if status:
        query = query.filter(Dataset.status == status.value)

    # Order by most recent first
    query = query.order_by(Dataset.created_at.desc())

    # Limit results
    datasets = query.limit(limit).all()

    return [
        DatasetListItem(
            id=ds.id,
            filename=ds.filename,
            file_type=ds.file_type,
            status=DatasetStatusSchema(ds.status),
            row_count=ds.row_count,
            created_at=ds.created_at,
            uploaded_by=ds.uploaded_by
        )
        for ds in datasets
    ]


@router.get("/{dataset_id}", response_model=DatasetUploadResponse)
async def get_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    institution_id: str = Depends(get_institution_id)
):
    """Get details of a specific dataset."""

    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.institution_id == 1  # TODO: Use actual institution_id in Phase 9
    ).first()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return DatasetUploadResponse(
        id=dataset.id,
        filename=dataset.filename,
        file_type=dataset.file_type,
        status=DatasetStatusSchema(dataset.status),
        s3_key=dataset.s3_key,
        row_count=dataset.row_count,
        validation_errors=dataset.validation_errors,
        created_at=dataset.created_at
    )


@router.delete("/{dataset_id}", response_model=MessageResponse)
async def delete_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    institution_id: str = Depends(get_institution_id)
):
    """Delete a dataset (removes from database and S3)."""

    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.institution_id == 1  # TODO: Use actual institution_id in Phase 9
    ).first()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Delete from S3
    s3_success = s3_service.delete_file(dataset.s3_key)
    if not s3_success:
        # Log warning but continue with database deletion
        pass

    # Delete from database
    db.delete(dataset)
    db.commit()

    return MessageResponse(
        message="Dataset deleted successfully",
        details={"dataset_id": dataset_id, "filename": dataset.filename}
    )


@router.get("/{dataset_id}/download")
async def download_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    institution_id: str = Depends(get_institution_id)
):
    """
    Generate a presigned URL for downloading the dataset file.
    """

    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.institution_id == 1  # TODO: Use actual institution_id in Phase 9
    ).first()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Generate presigned URL (valid for 1 hour)
    download_url = s3_service.get_file_url(dataset.s3_key, expiration=3600)

    if not download_url:
        raise HTTPException(status_code=500, detail="Failed to generate download URL")

    return {
        "dataset_id": dataset_id,
        "filename": dataset.filename,
        "download_url": download_url,
        "expires_in_seconds": 3600
    }