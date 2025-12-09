"""
Export utilities for timetables.
Supports multiple export formats: XLSX, CSV, JSON, PDF, PNG.
"""

import pandas as pd
from typing import Dict, Any, List, Optional
from abc import ABC, abstractmethod
from sqlalchemy.orm import Session
from datetime import datetime
import os

from classsync_core.models import Timetable, TimetableEntry, Course, Teacher, Room, Section


class BaseExporter(ABC):
    """Base class for all exporters."""

    def __init__(self, db: Session):
        self.db = db

    @abstractmethod
    def export(self, timetable_id: int, output_path: str, **kwargs) -> str:
        """
        Export timetable to file.

        Args:
            timetable_id: ID of timetable to export
            output_path: Path where file should be saved
            **kwargs: Additional export options

        Returns:
            Path to exported file
        """
        pass

    def load_timetable_data(self, timetable_id: int) -> pd.DataFrame:
        """
        Load timetable data as DataFrame with all related information.

        Args:
            timetable_id: ID of timetable to load

        Returns:
            DataFrame with complete timetable data
        """
        # Get timetable
        timetable = self.db.query(Timetable).filter(
            Timetable.id == timetable_id
        ).first()

        if not timetable:
            raise ValueError(f"Timetable {timetable_id} not found")

        # Get all entries
        entries = self.db.query(TimetableEntry).filter(
            TimetableEntry.timetable_id == timetable_id
        ).all()

        # Build DataFrame with full details
        data = []
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

        for entry in entries:
            # Load related entities
            course = self.db.query(Course).get(entry.course_id)
            teacher = self.db.query(Teacher).get(entry.teacher_id)
            room = self.db.query(Room).get(entry.room_id)
            section = self.db.query(Section).get(entry.section_id)

            data.append({
                'Timetable_ID': timetable_id,
                'Entry_ID': entry.id,
                'Course_Code': course.code if course else 'Unknown',
                'Course_Name': course.name if course else 'Unknown',
                'Section': section.code if section else 'Unknown',
                'Instructor': teacher.name if teacher else 'Unknown',
                'Teacher_Code': teacher.code if teacher else 'Unknown',
                'Room': room.code if room else 'Unknown',
                'Room_Type': room.room_type.value if room else 'Unknown',
                'Building': room.building if room else 'Unknown',
                'Weekday': day_names[entry.day_of_week] if entry.day_of_week < len(day_names) else 'Unknown',
                'Start_Time': entry.start_time,
                'End_Time': entry.end_time,
                'Duration_Minutes': self._calculate_duration(entry.start_time, entry.end_time),
                'Semester': timetable.semester,
                'Year': timetable.year
            })

        return pd.DataFrame(data)

    def _calculate_duration(self, start_time: str, end_time: str) -> int:
        """Calculate duration in minutes between two times."""
        from classsync_core.utils import parse_time, time_to_minutes

        start_min = time_to_minutes(parse_time(start_time))
        end_min = time_to_minutes(parse_time(end_time))

        return end_min - start_min


class ExportManager:
    """Manager class to handle all export operations."""

    def __init__(self, db: Session):
        self.db = db
        self.exporters = {}

    def register_exporter(self, format_name: str, exporter: BaseExporter):
        """Register an exporter for a specific format."""
        self.exporters[format_name] = exporter

    def export_timetable(
            self,
            timetable_id: int,
            format: str,
            output_path: str,
            **kwargs
    ) -> str:
        """
        Export timetable in specified format.

        Args:
            timetable_id: ID of timetable to export
            format: Export format (xlsx, csv, json, pdf, png)
            output_path: Path where file should be saved
            **kwargs: Additional format-specific options

        Returns:
            Path to exported file
        """
        if format not in self.exporters:
            raise ValueError(f"Unsupported export format: {format}")

        exporter = self.exporters[format]
        return exporter.export(timetable_id, output_path, **kwargs)