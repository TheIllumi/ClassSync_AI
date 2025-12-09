"""
Timetable Optimizer - Integrates genetic algorithm with ClassSync AI database.

This module wraps the existing genetic algorithm and adapts it to work with
SQLAlchemy models instead of CSV files.
"""

import pandas as pd
import numpy as np
import random
from datetime import time, datetime, timedelta
from typing import List, Tuple, Dict, Any, Optional
from sqlalchemy.orm import Session
from collections import defaultdict

from classsync_core.models import (
    Course, Teacher, Room, Section, ConstraintConfig,
    Timetable, TimetableEntry
)


class TimetableOptimizer:
    """
    Main optimizer class that generates timetables using genetic algorithm.
    Adapted from enhanced_timetable_optimizer.py to work with database models.
    """

    def __init__(self, constraint_config: ConstraintConfig):
        """
        Initialize optimizer with constraint configuration.

        Args:
            constraint_config: ConstraintConfig from database
        """
        self.config = constraint_config
        self.progress = 0.0
        self.status = "initializing"

        # Build working configuration
        self.working_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][:constraint_config.days_per_week]
        self.slot_duration_minutes = constraint_config.timeslot_duration_minutes
        self.daily_start = self._parse_time(constraint_config.start_time)
        self.daily_end = self._parse_time(constraint_config.end_time)

    def _parse_time(self, time_str: str) -> time:
        """Parse time string to time object."""
        h, m = map(int, time_str.split(':'))
        return time(h, m)

    def load_data_from_db(
            self,
            db: Session,
            institution_id: int
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Load courses and rooms from database and convert to DataFrames.

        Args:
            db: Database session
            institution_id: Institution ID for filtering

        Returns:
            Tuple of (courses_df, rooms_df)
        """
        self.status = "loading_data"
        self.progress = 0.1

        # Load courses with related data
        courses = db.query(Course).filter(
            Course.institution_id == institution_id,
            Course.is_deleted == False
        ).all()

        # Load sections for these courses
        sections = db.query(Section).filter(
            Section.institution_id == institution_id,
            Section.is_deleted == False
        ).all()

        # Load rooms
        rooms = db.query(Room).filter(
            Room.institution_id == institution_id,
            Room.is_deleted == False
        ).all()

        # Convert to DataFrames (format expected by existing optimizer)
        courses_data = []
        for section in sections:
            course = db.query(Course).get(section.course_id)
            teacher = db.query(Teacher).get(course.teacher_id)

            courses_data.append({
                'Course Name': course.name,
                'Course Code': course.code,
                'Instructor': teacher.name if teacher else 'Unknown',
                'Section': section.code,
                'Program': section.name or section.code,
                'Type': 'Lab' if course.course_type.value == 'lab' else 'Theory',
                'Hours per week': course.credit_hours,
                'Duration_Minutes': course.duration_minutes,
                'Sessions_Per_Week': course.sessions_per_week,
                'Course_Key': f"{course.name} - {section.code}"
            })

        courses_df = pd.DataFrame(courses_data)

        # Convert rooms to DataFrame
        rooms_data = []
        for room in rooms:
            rooms_data.append({
                'Rooms': room.code,
                'Type': 'Lab' if room.room_type.value == 'lab' else 'Theory',
                'Capacity': room.capacity,
                'Building': room.building or 'Main'
            })

        rooms_df = pd.DataFrame(rooms_data)

        self.progress = 0.2
        return courses_df, rooms_df

    def generate_time_slots(self) -> List[Tuple[str, str, str]]:
        """
        Generate time slots based on configuration.

        Returns:
            List of (day, start_time, end_time) tuples
        """
        slots = []
        start_dt = datetime.combine(datetime.today(), self.daily_start)
        end_dt = datetime.combine(datetime.today(), self.daily_end)
        delta = timedelta(minutes=self.slot_duration_minutes)

        time_slots = []
        while start_dt + delta <= end_dt:
            slot_start = start_dt.strftime("%H:%M")
            slot_end = (start_dt + delta).strftime("%H:%M")
            time_slots.append((slot_start, slot_end))
            start_dt += delta

        # Create slots for each working day
        for day in self.working_days:
            for start, end in time_slots:
                slots.append((day, start, end))

        return slots

    def create_sessions_from_courses(self, courses_df: pd.DataFrame) -> pd.DataFrame:
        """
        Create individual session entries from courses.
        Adapted from original create_sessions_from_courses function.
        """
        sessions = []

        for _, row in courses_df.iterrows():
            course_type = row['Type']
            hours_per_week = row.get('Hours per week', 3)
            duration_minutes = row.get('Duration_Minutes', 90)
            sessions_per_week = row.get('Sessions_Per_Week', 1)

            # Calculate slots needed based on duration
            slots_per_session = duration_minutes // self.slot_duration_minutes

            # Create sessions based on type and hours
            for session_num in range(sessions_per_week):
                sessions.append({
                    "Course_Key": row['Course_Key'],
                    "Course_Name": row['Course Name'],
                    "Instructor": row['Instructor'],
                    "Section": row['Section'],
                    "Program": row.get('Program', row['Section']),
                    "Type": course_type,
                    "Duration_Slots": slots_per_session,
                    "Hours_Per_Week": hours_per_week,
                    "Session_Number": session_num + 1
                })

        return pd.DataFrame(sessions)

    def generate_timetable(
            self,
            db: Session,
            institution_id: int,
            population_size: int = 30,
            generations: int = 100,
            **kwargs
    ) -> Dict[str, Any]:
        """
        Main entry point - generate optimized timetable.

        Args:
            db: Database session
            institution_id: Institution ID
            population_size: GA population size
            generations: Number of generations
            **kwargs: Additional parameters

        Returns:
            Dictionary with results including timetable_id, score, metadata
        """
        try:
            self.status = "running"
            start_time = datetime.utcnow()

            # Load data
            courses_df, rooms_df = self.load_data_from_db(db, institution_id)

            if courses_df.empty:
                return {
                    'success': False,
                    'error': 'No courses found for institution',
                    'timetable_id': None
                }

            # Create sessions
            sessions_df = self.create_sessions_from_courses(courses_df)
            self.progress = 0.3

            # Generate time slots
            slots = self.generate_time_slots()
            self.progress = 0.4

            # For now, create a simple greedy schedule
            # TODO: Integrate full genetic algorithm in Phase 5B
            schedule_df = self._simple_greedy_schedule(sessions_df, slots, rooms_df)

            self.progress = 0.9

            # Save to database
            timetable_id = self._save_to_database(
                db, institution_id, schedule_df,
                len(sessions_df), start_time
            )

            self.progress = 1.0
            self.status = "completed"

            generation_time = (datetime.utcnow() - start_time).total_seconds()

            return {
                'success': True,
                'timetable_id': timetable_id,
                'fitness_score': 85.0,  # Placeholder
                'generation_time': generation_time,
                'sessions_scheduled': len(schedule_df),
                'sessions_total': len(sessions_df),
                'conflict_count': 0  # Placeholder
            }

        except Exception as e:
            self.status = "failed"
            return {
                'success': False,
                'error': str(e),
                'timetable_id': None
            }

    def _simple_greedy_schedule(
            self,
            sessions_df: pd.DataFrame,
            slots: List[Tuple],
            rooms_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Simple greedy scheduler - assigns sessions to first available slot.
        This is a placeholder - full GA will be integrated in Phase 5B.
        """
        schedule = []
        used_slots = set()  # (day, time, resource_type, resource_id)

        lab_rooms = rooms_df[rooms_df['Type'].str.lower() == 'lab']['Rooms'].tolist()
        theory_rooms = rooms_df[rooms_df['Type'].str.lower() == 'theory']['Rooms'].tolist()

        for idx, session in sessions_df.iterrows():
            session_type = session['Type']
            duration_slots = session['Duration_Slots']
            instructor = session['Instructor']
            section = session['Section']

            # Choose room type
            available_rooms = lab_rooms if session_type == 'Lab' else theory_rooms
            if not available_rooms:
                available_rooms = rooms_df['Rooms'].tolist()

            # Try to find available slot
            placed = False
            for slot_idx in range(len(slots) - duration_slots + 1):
                day, start_time, _ = slots[slot_idx]

                # Calculate end time
                end_slot = slots[slot_idx + duration_slots - 1]
                end_time = end_slot[2]

                # Try each room
                for room in available_rooms:
                    # Check conflicts
                    has_conflict = False

                    # Check all slots this session would occupy
                    for s in range(duration_slots):
                        check_day, check_start, check_end = slots[slot_idx + s]

                        # Check teacher conflict
                        if (check_day, check_start, 'teacher', instructor) in used_slots:
                            has_conflict = True
                            break

                        # Check room conflict
                        if (check_day, check_start, 'room', room) in used_slots:
                            has_conflict = True
                            break

                        # Check section conflict
                        if (check_day, check_start, 'section', section) in used_slots:
                            has_conflict = True
                            break

                    if not has_conflict:
                        # Place the session
                        for s in range(duration_slots):
                            check_day, check_start, check_end = slots[slot_idx + s]
                            used_slots.add((check_day, check_start, 'teacher', instructor))
                            used_slots.add((check_day, check_start, 'room', room))
                            used_slots.add((check_day, check_start, 'section', section))

                        schedule.append({
                            'Course_Key': session['Course_Key'],
                            'Course_Name': session['Course_Name'],
                            'Instructor': instructor,
                            'Section': section,
                            'Program': session['Program'],
                            'Type': session_type,
                            'Room': room,
                            'Weekday': day,
                            'Start_Time': start_time,
                            'End_Time': end_time,
                            'Duration_Slots': duration_slots,
                            'Session_Number': session['Session_Number']
                        })

                        placed = True
                        break

                if placed:
                    break

        return pd.DataFrame(schedule)

    def _save_to_database(
            self,
            db: Session,
            institution_id: int,
            schedule_df: pd.DataFrame,
            total_sessions: int,
            start_time: datetime
    ) -> int:
        """Save generated timetable to database."""
        generation_time = (datetime.utcnow() - start_time).total_seconds()

        # Create Timetable record
        timetable = Timetable(
            institution_id=institution_id,
            name=f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
            semester="Fall",  # TODO: Get from config
            year=datetime.utcnow().year,
            status="COMPLETED",
            generation_time_seconds=generation_time,
            constraint_score=85.0,  # Placeholder
            conflict_count=0,  # Placeholder
            constraint_config=self.config.hard_constraints,  # Store config snapshot
            generated_by=1  # TODO: Get from auth
        )

        db.add(timetable)
        db.flush()  # Get the ID

        # Create TimetableEntry records
        day_map = {
            'Monday': 0, 'Tuesday': 1, 'Wednesday': 2,
            'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6
        }

        for _, row in schedule_df.iterrows():
            # Find section, course, teacher, room IDs
            # Note: This is simplified - in production, maintain ID mappings
            entry = TimetableEntry(
                timetable_id=timetable.id,
                section_id=1,  # TODO: Lookup actual IDs
                course_id=1,
                teacher_id=1,
                room_id=1,
                day_of_week=day_map.get(row['Weekday'], 0),
                start_time=row['Start_Time'],
                end_time=row['End_Time']
            )
            db.add(entry)

        db.commit()

        return timetable.id

    def get_progress(self) -> Dict[str, Any]:
        """Get current optimization progress."""
        return {
            'status': self.status,
            'progress': self.progress,
            'message': f"{int(self.progress * 100)}% complete"
        }