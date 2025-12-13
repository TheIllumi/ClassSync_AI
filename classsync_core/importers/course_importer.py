"""
Course importer - creates Teacher, Course, and Section records from validated CSV data.
"""

import pandas as pd
from typing import Dict, Any
from sqlalchemy.orm import Session

from classsync_core.importers.base_importer import BaseImporter, ImportResult
from classsync_core.models import Course, Teacher, Section, CourseType


class CourseImporter(BaseImporter):
    """Import courses, teachers, and sections from validated dataset."""

    def __init__(self, db: Session, institution_id: int = 1):
        super().__init__(db, institution_id)
        self.teacher_cache: Dict[str, int] = {}  # name -> teacher_id
        self.course_cache: Dict[str, int] = {}  # course_name -> course_id

    def import_from_dataframe(self, df: pd.DataFrame) -> ImportResult:
        """
        Import courses from DataFrame.

        Expected columns: course_name, instructor, section, program, type, hours_per_week
        Optional: course_code, duration_minutes, sessions_per_week

        Args:
            df: DataFrame with validated course data

        Returns:
            ImportResult with statistics
        """
        df = self.normalize_dataframe(df)

        # Validate required columns
        required = ['course_name', 'instructor', 'section', 'program', 'type', 'hours_per_week']
        missing = [col for col in required if col not in df.columns]
        if missing:
            self.result.errors.append(f"Missing columns: {missing}")
            return self.result

        try:
            # Step 1: Import all unique teachers
            self._import_teachers(df)

            # Step 2: Import courses and sections
            self._import_courses_and_sections(df)

            # Commit if successful
            if self.result.success:
                self.commit()
            else:
                self.rollback()

        except Exception as e:
            self.rollback()
            self.result.errors.append(f"Import failed: {str(e)}")

        return self.result

    def _import_teachers(self, df: pd.DataFrame):
        """Import all unique teachers from the instructor column."""
        unique_teachers = df['instructor'].unique()

        for teacher_name in unique_teachers:
            teacher_name = str(teacher_name).strip()

            if not teacher_name or teacher_name.lower() in ['', 'tba', 'tbd', 'n/a']:
                continue

            # Check if teacher exists
            existing = self.db.query(Teacher).filter(
                Teacher.name == teacher_name,
                Teacher.institution_id == self.institution_id,
                Teacher.is_deleted == False
            ).first()

            if existing:
                self.teacher_cache[teacher_name] = existing.id
                self.result.skipped_count += 1
            else:
                # Generate teacher code
                name_parts = teacher_name.split()
                code_base = ''.join([p[0].upper() for p in name_parts[:3]])
                teacher_code = f"{code_base}{abs(hash(teacher_name)) % 100:02d}"

                # Create teacher
                teacher = Teacher(
                    institution_id=self.institution_id,
                    code=teacher_code,
                    name=teacher_name,
                    email=f"{teacher_name.lower().replace(' ', '.')}@university.edu"
                )
                self.db.add(teacher)
                self.db.flush()

                self.teacher_cache[teacher_name] = teacher.id
                self.result.created_count += 1

    def _import_courses_and_sections(self, df: pd.DataFrame):
        """Import courses and their sections."""
        
        # Track counts of (course_name, section_code) encountered in this batch
        # to handle duplicate section codes by appending a suffix
        section_counts = {}

        for index, row in df.iterrows():
            row_num = index + 2

            try:
                # Get or create course
                course_id = self._get_or_create_course(row, row_num)

                if course_id:
                    # Determine unique section code for this row
                    course_name = str(row['course_name']).strip()
                    original_section_code = str(row['section']).strip()
                    
                    key = (course_name, original_section_code)
                    
                    if key in section_counts:
                        section_counts[key] += 1
                        # Append suffix for duplicates within this file
                        # e.g., "A" -> "A-1", "A-2"
                        section_code = f"{original_section_code}-{section_counts[key]}"
                    else:
                        section_counts[key] = 0
                        section_code = original_section_code

                    # Create section with potentially modified code
                    self._create_section(course_id, section_code, row, row_num)

            except Exception as e:
                self.log_error(row_num, f"Failed to import course/section: {str(e)}")

    def _get_or_create_course(self, row: pd.Series, row_num: int) -> int:
        """Get existing course or create new one."""
        course_name = str(row['course_name']).strip()
        course_type_str = str(row['type']).strip().lower()
        hours_per_week = int(row.get('hours_per_week', 3))

        # Generate course code from course name (not including section)
        if 'course_code' in row and row['course_code']:
            course_code = str(row['course_code']).strip()
        else:
            code_parts = ''.join([word[0].upper() for word in course_name.split()[:3]])
            course_code = f"{code_parts}{abs(hash(course_name)) % 1000:03d}"

        # Check cache by course_name (NOT course_name + section)
        if course_name in self.course_cache:
            return self.course_cache[course_name]

        # Map course type
        course_type = CourseType.LAB if course_type_str == 'lab' else CourseType.LECTURE

        # Check if course exists (by name OR code, not section)
        existing = self.db.query(Course).filter(
            Course.name == course_name,
            Course.institution_id == self.institution_id,
            Course.is_deleted == False
        ).first()

        if existing:
            self.course_cache[course_name] = existing.id
            return existing.id

        # For courses with multiple instructors (sections A, B with different teachers),
        # we'll use the first instructor we encounter as the "primary" teacher
        # (The real relationship is Section -> Teacher, not Course -> Teacher)
        instructor_name = str(row['instructor']).strip()
        teacher_id = self.teacher_cache.get(instructor_name)

        # Determine duration and sessions based on type and hours
        if course_type == CourseType.LAB:
            duration_minutes = 180  # 3 hours for labs
            sessions_per_week = 1
        else:
            if hours_per_week == 2:
                duration_minutes = 120  # 2 hours
                sessions_per_week = 1
            elif hours_per_week == 3:
                duration_minutes = 90  # 1.5 hours
                sessions_per_week = 2
            else:
                duration_minutes = 90
                sessions_per_week = max(1, hours_per_week // 2)

        # Create course
        course = Course(
            institution_id=self.institution_id,
            teacher_id=teacher_id,  # Primary teacher (may be overridden by sections)
            code=course_code,
            name=course_name,
            course_type=course_type,
            credit_hours=hours_per_week,
            duration_minutes=duration_minutes,
            sessions_per_week=sessions_per_week
        )
        self.db.add(course)
        self.db.flush()

        self.course_cache[course_name] = course.id
        self.result.created_count += 1

        return course.id

    def _create_section(self, course_id: int, section_code: str, row: pd.Series, row_num: int):
        """Create a section for a course."""
        # section_code is passed in now, potentially modified
        program = str(row.get('program', section_code)).strip()

        # Check if section exists
        existing = self.db.query(Section).filter(
            Section.code == section_code,
            Section.course_id == course_id,
            Section.institution_id == self.institution_id,
            Section.is_deleted == False
        ).first()

        if existing:
            self.result.skipped_count += 1
            return

        # Create section
        section = Section(
            institution_id=self.institution_id,
            course_id=course_id,
            code=section_code,
            name=program,
            semester="Fall",
            year=2025,
            student_count=50  # Default
        )
        self.db.add(section)
        self.db.flush()

        self.result.created_count += 1