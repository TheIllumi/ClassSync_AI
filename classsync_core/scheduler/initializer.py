"""
Population Initializer - Creates initial population of chromosomes.
Uses both random and heuristic-seeded initialization.
"""
import pandas as pd
import random
from typing import List
from classsync_core.scheduler.chromosome import Chromosome, Gene
from classsync_core.scheduler.config import GAConfig
from classsync_core.utils import calculate_slot_end_time, time_to_minutes


class PopulationInitializer:

    def __init__(self, config: GAConfig, sessions_df: pd.DataFrame, rooms_df: pd.DataFrame):
        self.config = config
        self.sessions_df = sessions_df
        self.rooms_df = rooms_df

        # Separate lab and theory rooms
        self.lab_rooms = rooms_df[
            rooms_df['Room_Type'].str.lower().str.contains('lab')
        ]['Room_Code'].tolist()

        self.theory_rooms = rooms_df[
            ~rooms_df['Room_Type'].str.lower().str.contains('lab')
        ]['Room_Code'].tolist()

        # All allowed time slots
        self.time_slots = self._generate_time_slots()


    def _generate_time_slots(self) -> List[tuple]:
        """Generate all valid (day, start_time) combinations."""
        slots = []
        for day in self.config.working_days:
            for start_time in self.config.allowed_start_times:
                # Skip if blocked
                end_time = calculate_slot_end_time(start_time, 30)  # Temporary end
                if not self.config.is_blocked(day, start_time, end_time):
                    slots.append((day, start_time))
        return slots


    def create_population(
            self,
            population_size: int,
            heuristic_seed_ratio: float = 0.20
    ) -> List[Chromosome]:
        """
        Create initial population.

        Args:
            population_size: Number of chromosomes to create
            heuristic_seed_ratio: Fraction to seed with heuristic (rest random)

        Returns:
            List of chromosomes
        """
        population = []

        # Number of heuristic-seeded individuals
        heuristic_count = int(population_size * heuristic_seed_ratio)
        random_count = population_size - heuristic_count

        # Create heuristic-seeded chromosomes
        for i in range(heuristic_count):
            chromosome = self._create_heuristic_chromosome()
            population.append(chromosome)

        # Create random chromosomes
        for i in range(random_count):
            chromosome = self._create_random_chromosome()
            population.append(chromosome)

        return population


    def _create_random_chromosome(self) -> Chromosome:
        """Create chromosome with completely random assignments."""
        genes = []
        day_end_minutes = time_to_minutes(self.config.day_end_time)

        for _, session in self.sessions_df.iterrows():
            duration = session['Duration_Minutes']
            
            # Filter valid slots for this duration
            valid_slots = []
            for day, start in self.time_slots:
                end_time = calculate_slot_end_time(start, duration)
                if time_to_minutes(end_time) <= day_end_minutes:
                    valid_slots.append((day, start))
            
            # If no valid slots (unlikely but possible for very long sessions), fall back to all
            if not valid_slots:
                valid_slots = self.time_slots

            # Random day and time
            day, start_time = random.choice(valid_slots)

            # Random room (appropriate type)
            if session['Is_Lab']:
                room_code = random.choice(self.lab_rooms) if self.lab_rooms else random.choice(
                    self.rooms_df['Room_Code'].tolist())
            else:
                room_code = random.choice(self.theory_rooms) if self.theory_rooms else random.choice(
                    self.rooms_df['Room_Code'].tolist())

            # Find room ID
            room_row = self.rooms_df[self.rooms_df['Room_Code'] == room_code].iloc[0]
            room_id = room_row.get('Room_ID', hash(room_code) % 10000)

            # Create gene
            gene = Gene(
                session_key=session['Session_Key'],
                course_id=session['Course_ID'],
                course_code=session['Course_Code'],
                course_name=session['Course_Name'],
                section_id=session['Section_ID'],
                section_code=session['Section_Code'],
                teacher_id=session['Teacher_ID'],
                teacher_name=session['Instructor'],
                duration_minutes=session['Duration_Minutes'],
                is_lab=session['Is_Lab'],
                session_number=session['Session_Number'],
                day=day,
                start_time=start_time,
                room_id=room_id,
                room_code=room_code
            )

            genes.append(gene)

        return Chromosome(genes)


    def _create_heuristic_chromosome(self) -> Chromosome:
        """
        Create chromosome using greedy heuristic.
        Places sessions one-by-one avoiding conflicts.
        """
        genes = []
        day_end_minutes = time_to_minutes(self.config.day_end_time)

        # Track used slots: {(day, start_time, room): True}
        used_slots = set()
        teacher_schedule = {}  # {teacher_id: {day: [start_time]}}
        section_schedule = {}  # {section_id: {day: [start_time]}}

        # Sort sessions by constraint difficulty (labs first)
        sessions = self.sessions_df.sort_values('Is_Lab', ascending=False)

        for _, session in sessions.iterrows():
            duration = session['Duration_Minutes']
            
            # Filter valid slots for this duration
            valid_slots = []
            for day, start in self.time_slots:
                end_time = calculate_slot_end_time(start, duration)
                if time_to_minutes(end_time) <= day_end_minutes:
                    valid_slots.append((day, start))
            
            if not valid_slots:
                valid_slots = self.time_slots

            # Try to find valid slot
            valid_slot_found = False
            attempts = 0
            max_attempts = 50

            # Get available rooms
            available_rooms = self.lab_rooms if session['Is_Lab'] else self.theory_rooms
            if not available_rooms:
                available_rooms = self.rooms_df['Room_Code'].tolist()

            random.shuffle(available_rooms)

            while not valid_slot_found and attempts < max_attempts:
                attempts += 1

                # Pick random day and time
                day, start_time = random.choice(valid_slots)
                end_time = calculate_slot_end_time(start_time, duration)

                # Check if blocked
                if self.config.is_blocked(day, start_time, end_time):
                    continue

                # Try each room
                for room_code in available_rooms:
                    room_row = self.rooms_df[self.rooms_df['Room_Code'] == room_code].iloc[0]
                    room_id = room_row.get('Room_ID', hash(room_code) % 10000)

                    # Check conflicts
                    slot_key = (day, start_time, room_code)
                    if slot_key in used_slots:
                        continue

                    # Check teacher conflict
                    teacher_id = session['Teacher_ID']
                    if teacher_id in teacher_schedule:
                        if day in teacher_schedule[teacher_id]:
                            if start_time in teacher_schedule[teacher_id][day]:
                                continue

                    # Check section conflict
                    section_id = session['Section_ID']
                    if section_id in section_schedule:
                        if day in section_schedule[section_id]:
                            if start_time in section_schedule[section_id][day]:
                                continue

                    # Valid placement found!
                    gene = Gene(
                        session_key=session['Session_Key'],
                        course_id=session['Course_ID'],
                        course_code=session['Course_Code'],
                        course_name=session['Course_Name'],
                        section_id=session['Section_ID'],
                        section_code=session['Section_Code'],
                        teacher_id=teacher_id,
                        teacher_name=session['Instructor'],
                        duration_minutes=session['Duration_Minutes'],
                        is_lab=session['Is_Lab'],
                        session_number=session['Session_Number'],
                        day=day,
                        start_time=start_time,
                        room_id=room_id,
                        room_code=room_code
                    )

                    genes.append(gene)
                    used_slots.add(slot_key)

                    # Update schedules
                    if teacher_id not in teacher_schedule:
                        teacher_schedule[teacher_id] = {}
                    if day not in teacher_schedule[teacher_id]:
                        teacher_schedule[teacher_id][day] = []
                    teacher_schedule[teacher_id][day].append(start_time)

                    if section_id not in section_schedule:
                        section_schedule[section_id] = {}
                    if day not in section_schedule[section_id]:
                        section_schedule[section_id][day] = []
                    section_schedule[section_id][day].append(start_time)

                    valid_slot_found = True
                    break

                if valid_slot_found:
                    break

            # If no valid slot found after max attempts, add with random assignment
            # (will be repaired later)
            if not valid_slot_found:
                day, start_time = random.choice(valid_slots)
                room_code = random.choice(available_rooms)
                room_row = self.rooms_df[self.rooms_df['Room_Code'] == room_code].iloc[0]
                room_id = room_row.get('Room_ID', hash(room_code) % 10000)

                gene = Gene(
                    session_key=session['Session_Key'],
                    course_id=session['Course_ID'],
                    course_code=session['Course_Code'],
                    course_name=session['Course_Name'],
                    section_id=session['Section_ID'],
                    section_code=session['Section_Code'],
                    teacher_id=session['Teacher_ID'],
                    teacher_name=session['Instructor'],
                    duration_minutes=session['Duration_Minutes'],
                    is_lab=session['Is_Lab'],
                    session_number=session['Session_Number'],
                    day=day,
                    start_time=start_time,
                    room_id=room_id,
                    room_code=room_code
                )
                genes.append(gene)

        return Chromosome(genes)