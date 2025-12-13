"""
Repair Mechanism - Fixes constraint violations in chromosomes.
"""
import random
from typing import List, Set, Dict
from collections import defaultdict
from classsync_core.scheduler.chromosome import Chromosome, Gene
from classsync_core.scheduler.config import GAConfig
from classsync_core.utils import slots_overlap, calculate_slot_end_time
class RepairMechanism:
    def __init__(self, config: GAConfig, rooms_df):
        self.config = config
        self.rooms_df = rooms_df

        # Room lists
        self.lab_rooms = rooms_df[
            rooms_df['Room_Type'].str.lower().str.contains('lab')
        ]['Room_Code'].tolist()

        self.theory_rooms = rooms_df[
            ~rooms_df['Room_Type'].str.lower().str.contains('lab')
        ]['Room_Code'].tolist()

        self.all_rooms = rooms_df['Room_Code'].tolist()

    def repair(self, chromosome: Chromosome) -> bool:
        """
        Repair chromosome to fix hard constraint violations.

        Args:
            chromosome: Chromosome to repair (modified in-place)

        Returns:
            True if successfully repaired, False if unrepairable
        """
        # Follow repair order from config
        for constraint_type in self.config.repair_order:
            if constraint_type == 'blocked_windows':
                if not self._repair_blocked_windows(chromosome):
                    return False

            elif constraint_type == 'invalid_start_times':
                if not self._repair_invalid_start_times(chromosome):
                    return False

            elif constraint_type == 'lab_contiguity':
                if not self._repair_lab_contiguity(chromosome):
                    return False

            elif constraint_type == 'teacher_conflicts':
                if not self._repair_resource_conflicts(chromosome, 'teacher'):
                    return False

            elif constraint_type == 'room_conflicts':
                if not self._repair_resource_conflicts(chromosome, 'room'):
                    return False

            elif constraint_type == 'section_conflicts':
                if not self._repair_resource_conflicts(chromosome, 'section'):
                    return False

        return True

    def _repair_blocked_windows(self, chromosome: Chromosome) -> bool:
        """Move sessions out of blocked time windows."""
        for gene in chromosome.genes:
            if self.config.is_blocked(gene.day, gene.start_time, gene.end_time):
                # Try to find nearby valid slot
                repaired = self._find_alternative_slot(gene, chromosome)
                if not repaired:
                    return False
        return True

    def _repair_invalid_start_times(self, chromosome: Chromosome) -> bool:
        """Snap start times to nearest allowed start time."""
        for gene in chromosome.genes:
            if not self.config.is_valid_start_time(gene.start_time):
                # Find nearest allowed start time
                nearest = self._find_nearest_start_time(gene.start_time)
                gene.update_time(gene.day, nearest)
        return True

    def _repair_lab_contiguity(self, chromosome: Chromosome) -> bool:
        """Ensure lab sessions are 180 minutes."""
        for gene in chromosome.genes:
            if gene.is_lab and gene.duration_minutes != 180:
                # Force to 180 minutes
                gene.duration_minutes = 180
                gene.end_time = calculate_slot_end_time(gene.start_time, 180)
                gene.duration_slots = 6
        return True

    def _repair_resource_conflicts(
            self,
            chromosome: Chromosome,
            resource_type: str
    ) -> bool:
        """
        Repair overlaps for a resource (teacher/room/section).

        Strategy: For each conflict, move one session to alternative slot.
        """
        # Build conflict index
        conflicts = self._find_resource_conflicts(chromosome, resource_type)

        if not conflicts:
            return True

        # Try to repair each conflict
        attempts = 0
        max_attempts = self.config.max_repair_attempts * len(conflicts)

        while conflicts and attempts < max_attempts:
            attempts += 1

            # Pick random conflict
            conflict_genes = random.choice(conflicts)

            # Try to move one of the conflicting genes
            for gene in conflict_genes:
                # Find gene index in chromosome
                gene_idx = next(
                    (i for i, g in enumerate(chromosome.genes) if g.session_key == gene.session_key),
                    None
                )

                if gene_idx is None:
                    continue

                # Try alternative slot
                if self._find_alternative_slot(chromosome.genes[gene_idx], chromosome):
                    break

            # Re-check conflicts
            conflicts = self._find_resource_conflicts(chromosome, resource_type)

        # If still conflicts after max attempts, fail
        return len(conflicts) == 0

    def _find_resource_conflicts(
            self,
            chromosome: Chromosome,
            resource_type: str
    ) -> List[List[Gene]]:
        """
        Find all conflicts for a resource type.

        Returns:
            List of conflict groups (each group = list of overlapping genes)
        """
        conflicts = []

        # Build schedule index
        schedule = defaultdict(lambda: defaultdict(list))

        for gene in chromosome.genes:
            if resource_type == 'teacher':
                resource_id = gene.teacher_id
            elif resource_type == 'room':
                resource_id = gene.room_id
            else:  # section
                resource_id = gene.section_id

            schedule[resource_id][gene.day].append(gene)

        # Check each resource's schedule for overlaps
        for resource_id, days in schedule.items():
            for day, genes in days.items():
                # Check all pairs
                for i in range(len(genes)):
                    for j in range(i + 1, len(genes)):
                        if slots_overlap(
                                genes[i].start_time, genes[i].end_time,
                                genes[j].start_time, genes[j].end_time
                        ):
                            conflicts.append([genes[i], genes[j]])

        return conflicts

    def _find_alternative_slot(
            self,
            gene: Gene,
            chromosome: Chromosome
    ) -> bool:
        """
        Find alternative slot for a gene that avoids conflicts.

        Args:
            gene: Gene to relocate
            chromosome: Current chromosome (for conflict checking)

        Returns:
            True if alternative found and applied
        """
        attempts = 0
        max_attempts = self.config.max_repair_attempts

        # Get available rooms
        if gene.is_lab:
            available_rooms = self.lab_rooms if self.lab_rooms else self.all_rooms
        else:
            available_rooms = self.theory_rooms if self.theory_rooms else self.all_rooms

        while attempts < max_attempts:
            attempts += 1

            # Random day and time
            new_day = random.choice(self.config.working_days)
            new_start = random.choice(self.config.allowed_start_times)
            new_end = calculate_slot_end_time(new_start, gene.duration_minutes)

            # Check if blocked
            if self.config.is_blocked(new_day, new_start, new_end):
                continue

            # Try random room
            new_room_code = random.choice(available_rooms)
            room_row = self.rooms_df[self.rooms_df['Room_Code'] == new_room_code].iloc[0]
            new_room_id = room_row.get('Room_ID', hash(new_room_code) % 10000)

            # Check if this creates conflicts
            temp_gene = Gene(
                session_key=gene.session_key,
                course_id=gene.course_id,
                course_code=gene.course_code,
                course_name=gene.course_name,
                section_id=gene.section_id,
                section_code=gene.section_code,
                teacher_id=gene.teacher_id,
                teacher_name=gene.teacher_name,
                duration_minutes=gene.duration_minutes,
                is_lab=gene.is_lab,
                session_number=gene.session_number,
                day=new_day,
                start_time=new_start,
                room_id=new_room_id,
                room_code=new_room_code
            )

            # Check for conflicts with other genes (excluding self)
            has_conflict = False
            for other_gene in chromosome.genes:
                if other_gene.session_key == gene.session_key:
                    continue

                # Teacher conflict
                if other_gene.teacher_id == temp_gene.teacher_id and other_gene.day == temp_gene.day:
                    if slots_overlap(
                            other_gene.start_time, other_gene.end_time,
                            temp_gene.start_time, temp_gene.end_time
                    ):
                        has_conflict = True
                        break

                # Room conflict
                if other_gene.room_id == temp_gene.room_id and other_gene.day == temp_gene.day:
                    if slots_overlap(
                            other_gene.start_time, other_gene.end_time,
                            temp_gene.start_time, temp_gene.end_time
                    ):
                        has_conflict = True
                        break

                # Section conflict
                if other_gene.section_id == temp_gene.section_id and other_gene.day == temp_gene.day:
                    if slots_overlap(
                            other_gene.start_time, other_gene.end_time,
                            temp_gene.start_time, temp_gene.end_time
                    ):
                        has_conflict = True
                        break

            if not has_conflict:
                # Apply the new assignment
                gene.update_time(new_day, new_start)
                gene.update_room(new_room_id, new_room_code)
                return True

        return False

    def _find_nearest_start_time(self, current_time: str) -> str:
        """Find nearest allowed start time."""
        from classsync_core.utils import time_to_minutes

        current_minutes = time_to_minutes(current_time)

        min_diff = float('inf')
        nearest = self.config.allowed_start_times[0]

        for allowed_time in self.config.allowed_start_times:
            allowed_minutes = time_to_minutes(allowed_time)
            diff = abs(current_minutes - allowed_minutes)

            if diff < min_diff:
                min_diff = diff
                nearest = allowed_time

        return nearest