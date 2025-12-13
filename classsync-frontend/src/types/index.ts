export interface Dataset {
    id: number
    institution_id: number
    dataset_type: string
    file_name: string
    file_path: string
    file_size: number
    row_count: number
    validation_status: string
    validation_errors: string[] | null
    uploaded_by: number
    created_at: string
    updated_at: string
}

export interface Timetable {
    id: number
    institution_id: number
    name: string
    semester: string
    year: number
    status: string
    generation_time_seconds: number
    constraint_score: number
    conflict_count: number
    generated_by: number
    created_at: string
    updated_at: string
}

export interface TimetableEntry {
    id: number
    timetable_id: number
    section_id: number
    course_id: number
    teacher_id: number
    room_id: number
    day_of_week: number
    start_time: string
    end_time: string
    created_at: string
    updated_at: string
}

export interface ConstraintConfig {
    id: number
    institution_id: number
    name: string
    is_active: boolean
    is_default: boolean
    timeslot_duration_minutes: number
    days_per_week: number
    start_time: string
    end_time: string
    hard_constraints: Record<string, any>
    soft_constraints: Record<string, any>
    optional_constraints: Record<string, any>
    created_at: string
    updated_at: string
}