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

    def calculate_fitness(self, schedule_df: pd.DataFrame) -> float:
        """
        Calculate fitness score for a schedule.
        Higher score = better schedule.

        Penalizes:
        - Teacher overlaps
        - Room conflicts
        - Section conflicts
        - Evening classes
        - Instructor gaps
        """
        if schedule_df.empty:
            return 0.0

        score = 1000.0  # Start with base score

        # Penalty weights from constraints
        soft_constraints = self.config.soft_constraints or {}

        # Check for overlaps (hard constraints)
        overlaps = self._check_overlaps(schedule_df)
        score -= overlaps * 100  # Heavy penalty for conflicts

        # Penalize evening classes
        evening_penalty_weight = soft_constraints.get('minimize_late_evening', {}).get('weight', 5)
        evening_threshold = soft_constraints.get('minimize_late_evening', {}).get('threshold', '16:00')
        evening_classes = len(schedule_df[schedule_df['Start_Time'] >= evening_threshold])
        score -= evening_classes * evening_penalty_weight

        # Penalize early morning classes
        morning_penalty_weight = soft_constraints.get('minimize_early_morning', {}).get('weight', 5)
        morning_threshold = soft_constraints.get('minimize_early_morning', {}).get('threshold', '09:00')
        early_classes = len(schedule_df[schedule_df['Start_Time'] < morning_threshold])
        score -= early_classes * morning_penalty_weight

        # Penalize instructor gaps
        gap_penalty_weight = soft_constraints.get('minimize_teacher_gaps', {}).get('weight', 8)
        instructor_gaps = self._calculate_instructor_gaps(schedule_df)
        score -= instructor_gaps * gap_penalty_weight

        # Reward compact schedules
        compactness_weight = soft_constraints.get('compact_student_schedules', {}).get('weight', 7)
        compactness_score = self._calculate_schedule_compactness(schedule_df)
        score += compactness_score * compactness_weight

        return max(0.0, score)

    def _check_overlaps(self, schedule_df: pd.DataFrame) -> int:
        """
        Check for hard constraint violations (overlaps).
        Returns count of violations.
        """
        violations = 0

        # Check teacher overlaps
        for day in self.working_days:
            day_schedule = schedule_df[schedule_df['Weekday'] == day]

            for instructor in day_schedule['Instructor'].unique():
                instructor_schedule = day_schedule[day_schedule['Instructor'] == instructor]

                # Check each pair of sessions
                for i, row1 in instructor_schedule.iterrows():
                    for j, row2 in instructor_schedule.iterrows():
                        if i >= j:
                            continue

                        # Check time overlap
                        from classsync_core.utils import slots_overlap
                        if slots_overlap(
                                row1['Start_Time'], row1['End_Time'],
                                row2['Start_Time'], row2['End_Time']
                        ):
                            violations += 1

        # Check room overlaps
        for day in self.working_days:
            day_schedule = schedule_df[schedule_df['Weekday'] == day]

            for room in day_schedule['Room'].unique():
                room_schedule = day_schedule[day_schedule['Room'] == room]

                for i, row1 in room_schedule.iterrows():
                    for j, row2 in room_schedule.iterrows():
                        if i >= j:
                            continue

                        from classsync_core.utils import slots_overlap
                        if slots_overlap(
                                row1['Start_Time'], row1['End_Time'],
                                row2['Start_Time'], row2['End_Time']
                        ):
                            violations += 1

        # Check section overlaps
        for day in self.working_days:
            day_schedule = schedule_df[schedule_df['Weekday'] == day]

            for section in day_schedule['Section'].unique():
                section_schedule = day_schedule[day_schedule['Section'] == section]

                for i, row1 in section_schedule.iterrows():
                    for j, row2 in section_schedule.iterrows():
                        if i >= j:
                            continue

                        from classsync_core.utils import slots_overlap
                        if slots_overlap(
                                row1['Start_Time'], row1['End_Time'],
                                row2['Start_Time'], row2['End_Time']
                        ):
                            violations += 1

        return violations

    def _calculate_instructor_gaps(self, schedule_df: pd.DataFrame) -> int:
        """Calculate total gap hours for all instructors."""
        total_gaps = 0

        from classsync_core.utils import time_to_minutes

        for instructor in schedule_df['Instructor'].unique():
            instructor_schedule = schedule_df[schedule_df['Instructor'] == instructor]

            for day in self.working_days:
                day_schedule = instructor_schedule[
                    instructor_schedule['Weekday'] == day
                    ].sort_values('Start_Time')

                if len(day_schedule) <= 1:
                    continue

                # Calculate gaps between consecutive classes
                times = day_schedule[['Start_Time', 'End_Time']].values
                for i in range(len(times) - 1):
                    from classsync_core.utils import parse_time
                    end_current = time_to_minutes(parse_time(times[i][1]))
                    start_next = time_to_minutes(parse_time(times[i + 1][0]))
                    gap = start_next - end_current

                    if gap > 30:  # Gap larger than 30 minutes
                        total_gaps += 1

        return total_gaps

    def _calculate_schedule_compactness(self, schedule_df: pd.DataFrame) -> float:
        """
        Calculate how compact the schedule is for students.
        Higher score = more compact (fewer days, clustered times).
        """
        if schedule_df.empty:
            return 0.0

        score = 0.0

        # Reward using fewer days
        days_used = schedule_df['Weekday'].nunique()
        score += (self.config.days_per_week - days_used) * 10

        # Reward time clustering per section
        for section in schedule_df['Section'].unique():
            section_schedule = schedule_df[schedule_df['Section'] == section]

            for day in self.working_days:
                day_schedule = section_schedule[section_schedule['Weekday'] == day]

                if len(day_schedule) > 1:
                    # Calculate time span
                    from classsync_core.utils import time_to_minutes, parse_time
                    start_times = [time_to_minutes(parse_time(t)) for t in day_schedule['Start_Time']]
                    end_times = [time_to_minutes(parse_time(t)) for t in day_schedule['End_Time']]

                    span = max(end_times) - min(start_times)

                    # Reward shorter spans (more clustered)
                    if span < 240:  # Less than 4 hours
                        score += 5

        return score

    def crossover(
            self,
            parent1_df: pd.DataFrame,
            parent2_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Two-point crossover between two parent schedules.

        Args:
            parent1_df: First parent schedule
            parent2_df: Second parent schedule

        Returns:
            Child schedule (DataFrame)
        """
        if parent1_df.empty or parent2_df.empty:
            return parent1_df if not parent1_df.empty else parent2_df

        # Determine crossover points
        len1 = len(parent1_df)
        len2 = len(parent2_df)

        if len1 < 2 or len2 < 2:
            return parent1_df.copy()

        # Random crossover point
        crossover_point = random.randint(1, min(len1, len2) - 1)

        # Take first part from parent1, second part from parent2
        child_df = pd.concat([
            parent1_df.iloc[:crossover_point],
            parent2_df.iloc[crossover_point:]
        ], ignore_index=True)

        # Remove duplicates (keep first occurrence)
        child_df = child_df.drop_duplicates(
            subset=['Course_Key', 'Session_Number'],
            keep='first'
        ).reset_index(drop=True)

        return child_df

    def mutate(
            self,
            schedule_df: pd.DataFrame,
            mutation_rate: float,
            all_slots: List[Tuple],
            rooms_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Randomly mutate a schedule by changing some assignments.

        Args:
            schedule_df: Schedule to mutate
            mutation_rate: Probability of mutating each assignment (0.0-1.0)
            all_slots: Available time slots
            rooms_df: Available rooms

        Returns:
            Mutated schedule
        """
        if schedule_df.empty or random.random() > mutation_rate:
            return schedule_df.copy()

        mutated = schedule_df.copy()

        # Randomly select assignments to mutate
        num_mutations = max(1, int(len(mutated) * mutation_rate))
        mutation_indices = random.sample(range(len(mutated)), min(num_mutations, len(mutated)))

        lab_rooms = rooms_df[rooms_df['Type'].str.lower() == 'lab']['Rooms'].tolist()
        theory_rooms = rooms_df[rooms_df['Type'].str.lower() == 'theory']['Rooms'].tolist()

        for idx in mutation_indices:
            session_type = mutated.iloc[idx]['Type']
            duration_slots = mutated.iloc[idx]['Duration_Slots']

            # Choose mutation type
            mutation_type = random.choice(['time', 'room', 'both'])

            if mutation_type in ['time', 'both']:
                # Change time slot
                new_slot_idx = random.randint(0, len(all_slots) - duration_slots)
                day, start_time, _ = all_slots[new_slot_idx]

                # Calculate end time
                from classsync_core.utils import calculate_slot_end_time
                duration_minutes = duration_slots * self.slot_duration_minutes
                end_time = calculate_slot_end_time(start_time, duration_minutes)

                mutated.at[idx, 'Weekday'] = day
                mutated.at[idx, 'Start_Time'] = start_time
                mutated.at[idx, 'End_Time'] = end_time

            if mutation_type in ['room', 'both']:
                # Change room
                available_rooms = lab_rooms if session_type == 'Lab' else theory_rooms
                if not available_rooms:
                    available_rooms = rooms_df['Rooms'].tolist()

                if available_rooms:
                    new_room = random.choice(available_rooms)
                    mutated.at[idx, 'Room'] = new_room

        return mutated

    def tournament_selection(
            self,
            population: List[pd.DataFrame],
            fitness_scores: List[float],
            tournament_size: int = 3
    ) -> pd.DataFrame:
        """
        Select an individual using tournament selection.

        Args:
            population: List of schedules
            fitness_scores: Corresponding fitness scores
            tournament_size: Number of individuals in tournament

        Returns:
            Selected schedule
        """
        if not population:
            return pd.DataFrame()

        # Randomly select tournament participants
        tournament_indices = random.sample(
            range(len(population)),
            min(tournament_size, len(population))
        )

        # Find best in tournament
        best_idx = tournament_indices[0]
        best_fitness = fitness_scores[tournament_indices[0]]

        for idx in tournament_indices[1:]:
            if fitness_scores[idx] > best_fitness:
                best_idx = idx
                best_fitness = fitness_scores[idx]

        return population[best_idx].copy()

    def generate_individual_enhanced(
            self,
            sessions_df: pd.DataFrame,
            slots: List[Tuple],
            rooms_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Generate a single schedule using greedy placement with conflict checking.
        Adapted from original enhanced_timetable_optimizer.py

        Args:
            sessions_df: Sessions to schedule
            slots: Available time slots
            rooms_df: Available rooms

        Returns:
            Schedule as DataFrame
        """
        schedule = []

        from classsync_core.utils import ConflictChecker, find_consecutive_slots

        conflict_checker = ConflictChecker()

        lab_rooms = rooms_df[rooms_df['Type'].str.lower() == 'lab']['Rooms'].tolist()
        theory_rooms = rooms_df[rooms_df['Type'].str.lower() == 'theory']['Rooms'].tolist()
        all_rooms = rooms_df['Rooms'].tolist()

        # Prioritize harder-to-place sessions
        sessions_df = sessions_df.copy()
        sessions_df['Priority'] = sessions_df.apply(
            lambda x: 100 if x['Type'] == 'Lab' else 50, axis=1
        )
        sessions_df = sessions_df.sort_values('Priority', ascending=False)

        used_slots = set()

        for _, session in sessions_df.iterrows():
            session_type = session['Type']
            duration_slots = session['Duration_Slots']
            instructor = session['Instructor']
            section = session['Section']

            # Choose appropriate rooms
            available_rooms = lab_rooms if session_type == 'Lab' else theory_rooms
            if not available_rooms:
                available_rooms = all_rooms

            placed = False

            # Try each day
            for day in self.working_days:
                if placed:
                    break

                # Find consecutive slots
                consecutive = find_consecutive_slots(
                    day, duration_slots, slots, used_slots
                )

                if not consecutive:
                    continue

                # Get start and end times
                start_time = consecutive[0][1]
                end_time = consecutive[-1][2]

                # Try each room
                for room in available_rooms:
                    # Check conflicts for all slots this session occupies
                    has_conflict = False

                    for slot in consecutive:
                        slot_day, slot_start, slot_end = slot

                        if conflict_checker.has_conflict(
                                slot_day, slot_start, instructor, room, section
                        ):
                            has_conflict = True
                            break

                    if not has_conflict:
                        # Place the session
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

                        # Mark slots as used
                        for slot in consecutive:
                            slot_day, slot_start, slot_end = slot
                            used_slots.add(slot)
                            conflict_checker.add_assignment(
                                slot_day, slot_start, instructor, room, section
                            )

                        placed = True
                        break

                if placed:
                    break

        return pd.DataFrame(schedule)

    def generate_population_enhanced(
            self,
            population_size: int,
            sessions_df: pd.DataFrame,
            slots: List[Tuple],
            rooms_df: pd.DataFrame
    ) -> List[pd.DataFrame]:
        """
        Generate initial population of schedules.

        Args:
            population_size: Number of individuals to generate
            sessions_df: Sessions to schedule
            slots: Available time slots
            rooms_df: Available rooms

        Returns:
            List of schedule DataFrames
        """
        population = []

        self.status = "generating_population"

        for i in range(population_size):
            # Shuffle sessions for diversity
            shuffled_sessions = sessions_df.sample(frac=1).reset_index(drop=True)

            individual = self.generate_individual_enhanced(
                shuffled_sessions, slots, rooms_df
            )

            population.append(individual)

            # Update progress
            self.progress = 0.4 + (0.1 * i / population_size)

        return population

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

            # Run full genetic algorithm optimization
            self.status = "optimizing"
            schedule_df, fitness_score, history = self.optimize_genetic_algorithm(
                sessions_df=sessions_df,
                slots=slots,
                rooms_df=rooms_df,
                population_size=population_size,
                generations=generations,
                elite_size=3,
                initial_mutation_rate=0.15
            )

            self.progress = 0.9

            # Save to database
            timetable_id = self._save_to_database(
                db, institution_id, schedule_df,
                len(sessions_df), start_time, fitness_score
            )

            self.progress = 1.0
            self.status = "completed"

            generation_time = (datetime.utcnow() - start_time).total_seconds()

            return {
                'success': True,
                'timetable_id': timetable_id,
                'fitness_score': fitness_score,  # Placeholder
                'generation_time': generation_time,
                'sessions_scheduled': len(schedule_df),
                'sessions_total': len(sessions_df),
                'conflict_count': self._check_overlaps(schedule_df)
            }

        except Exception as e:
            self.status = "failed"
            return {
                'success': False,
                'error': str(e),
                'timetable_id': None
            }

    def optimize_genetic_algorithm(
            self,
            sessions_df: pd.DataFrame,
            slots: List[Tuple],
            rooms_df: pd.DataFrame,
            population_size: int = 30,
            generations: int = 100,
            elite_size: int = 3,
            initial_mutation_rate: float = 0.15
    ) -> Tuple[pd.DataFrame, float, List[float]]:
        """
        Run genetic algorithm optimization.

        Args:
            sessions_df: Sessions to schedule
            slots: Available time slots
            rooms_df: Available rooms
            population_size: Size of population
            generations: Number of generations
            elite_size: Number of elites to keep
            initial_mutation_rate: Starting mutation rate

        Returns:
            Tuple of (best_schedule, best_score, fitness_history)
        """
        self.status = "optimizing"

        # Generate initial population
        population = self.generate_population_enhanced(
            population_size, sessions_df, slots, rooms_df
        )

        fitness_history = []
        best_schedule = None
        best_fitness = -float('inf')

        mutation_rate = initial_mutation_rate
        stagnation_counter = 0

        for generation in range(generations):
            # Evaluate fitness for all individuals
            fitness_scores = [self.calculate_fitness(ind) for ind in population]

            # Track best
            gen_best_fitness = max(fitness_scores)
            gen_best_idx = fitness_scores.index(gen_best_fitness)

            if gen_best_fitness > best_fitness:
                best_fitness = gen_best_fitness
                best_schedule = population[gen_best_idx].copy()
                stagnation_counter = 0
            else:
                stagnation_counter += 1

            fitness_history.append(best_fitness)

            # Update progress
            self.progress = 0.5 + (0.4 * generation / generations)

            # Adaptive mutation rate
            if stagnation_counter > 10:
                mutation_rate = min(0.3, mutation_rate * 1.1)
                stagnation_counter = 0
            else:
                mutation_rate = max(0.05, mutation_rate * 0.99)

            # Create next generation
            new_population = []

            # Elitism - keep best individuals
            elite_indices = sorted(
                range(len(fitness_scores)),
                key=lambda i: fitness_scores[i],
                reverse=True
            )[:elite_size]

            for idx in elite_indices:
                new_population.append(population[idx].copy())

            # Generate rest through crossover and mutation
            while len(new_population) < population_size:
                # Select parents
                parent1 = self.tournament_selection(population, fitness_scores)
                parent2 = self.tournament_selection(population, fitness_scores)

                # Crossover
                child = self.crossover(parent1, parent2)

                # Mutation
                child = self.mutate(child, mutation_rate, slots, rooms_df)

                new_population.append(child)

            population = new_population

        return best_schedule, best_fitness, fitness_history

    def _save_to_database(
            self,
            db: Session,
            institution_id: int,
            schedule_df: pd.DataFrame,
            total_sessions: int,
            start_time: datetime,
            fitness_score: float = 85.0
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
            constraint_score=fitness_score,
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