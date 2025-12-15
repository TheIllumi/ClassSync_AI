import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    Sparkles,
    Loader2,
    Plus,
    Trash2,
    User,
    AlertCircle,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Settings2,
    Lock,
    Unlock
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { timetablesApi, constraintsApi, teachersApi, datasetsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { TeacherConstraint, ConstraintType, Teacher, ConstraintConfig } from '@/types'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TIME_SLOTS = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00'
]

const CONSTRAINT_TYPES: { value: ConstraintType; label: string; description: string }[] = [
    { value: 'blocked_slot', label: 'Blocked Slot', description: 'Teacher is unavailable at this time' },
    { value: 'day_off', label: 'Day Off', description: 'Teacher wants this day off' },
    { value: 'available_window', label: 'Available Window', description: 'Teacher is only available during this time' },
    { value: 'preferred_slot', label: 'Preferred Slot', description: 'Teacher prefers this time slot' },
]

// Validation types
interface ValidationError {
    type: 'error' | 'warning'
    message: string
    details?: string
}

// Time helper functions
function timeToMinutes(time: string | undefined | null): number {
    if (!time || typeof time !== 'string') return 0
    try {
        const parts = time.split(':')
        if (parts.length !== 2) return 0
        const [hours, minutes] = parts.map(Number)
        if (isNaN(hours) || isNaN(minutes)) return 0
        return hours * 60 + minutes
    } catch (e) {
        return 0
    }
}

function slotsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const s1 = timeToMinutes(start1)
    const e1 = timeToMinutes(end1)
    const s2 = timeToMinutes(start2)
    const e2 = timeToMinutes(end2)
    // Ensure valid ranges
    if (s1 >= e1 || s2 >= e2) return false
    return s1 < e2 && s2 < e1
}

export function GenerateTimetable() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    // State for constraint configuration
    const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
    const [teacherConstraints, setTeacherConstraints] = useState<TeacherConstraint[]>([])
    const [showAddConstraint, setShowAddConstraint] = useState(false)
    const [expandedSections, setExpandedSections] = useState({
        constraints: true,
        settings: false,
    })

    // Form state for adding constraints
    const [newConstraint, setNewConstraint] = useState<Partial<TeacherConstraint>>({
        teacher_id: 0,
        constraint_type: 'blocked_slot',
        is_hard: false,
        weight: 5,
        day: 'Monday',
        start_time: '09:00',
        end_time: '12:00',
    })

    // Optimization settings
    const [settings, setSettings] = useState({
        population_size: 30,
        generations: 100,
        target_fitness: 85,
        random_seed: undefined as number | undefined,
    })

    // Validation function for constraints
    const validateConstraints = (): ValidationError[] => {
        try {
            const errors: ValidationError[] = []
            const config = selectedConfig || defaultConfig

            // Group constraints by teacher
            const constraintsByTeacher = new Map<number, TeacherConstraint[]>()
            teacherConstraints.forEach(c => {
                const existing = constraintsByTeacher.get(c.teacher_id) || []
                constraintsByTeacher.set(c.teacher_id, [...existing, c])
            })

            // Check each teacher's constraints
            constraintsByTeacher.forEach((constraints, teacherId) => {
                const teacherName = getTeacherNameById(teacherId)

                // Get blocked slots for this teacher
                const blockedSlots = constraints.filter(c =>
                    c.constraint_type === 'blocked_slot' && c.day && c.start_time && c.end_time
                )

                // Get day-offs for this teacher
                const dayOffs = constraints.filter(c => c.constraint_type === 'day_off')
                const dayOffDays = new Set<string>()
                dayOffs.forEach(d => {
                    if (d.days) d.days.forEach(day => dayOffDays.add(day))
                    if (d.day) dayOffDays.add(d.day)
                })

                // 1. Check for overlapping blocked slots on the same day
                for (let i = 0; i < blockedSlots.length; i++) {
                    for (let j = i + 1; j < blockedSlots.length; j++) {
                        const slot1 = blockedSlots[i]
                        const slot2 = blockedSlots[j]

                        if (slot1.day === slot2.day &&
                            slotsOverlap(slot1.start_time!, slot1.end_time!, slot2.start_time!, slot2.end_time!)) {
                            errors.push({
                                type: 'warning',
                                message: `Overlapping blocked slots for ${teacherName}`,
                                details: `${slot1.day}: ${slot1.start_time}-${slot1.end_time} overlaps with ${slot2.start_time}-${slot2.end_time}`
                            })
                        }
                    }
                }

                // 2. Check for blocked slot on day-off (redundant)
                blockedSlots.forEach(slot => {
                    if (slot.day && dayOffDays.has(slot.day)) {
                        errors.push({
                            type: 'warning',
                            message: `Redundant blocked slot for ${teacherName}`,
                            details: `${slot.day} is already a day-off, blocked slot is unnecessary`
                        })
                    }
                })

                // 3. Check if time slots are within institution hours
                if (config && config.start_time && config.end_time) {
                    try {
                        const dayStart = timeToMinutes(config.start_time)
                        const dayEnd = timeToMinutes(config.end_time)

                        blockedSlots.forEach(slot => {
                            if (slot.start_time && slot.end_time) {
                                const slotStart = timeToMinutes(slot.start_time)
                                const slotEnd = timeToMinutes(slot.end_time)

                                if (slotStart < dayStart) {
                                    errors.push({
                                        type: 'warning',
                                        message: `Blocked slot starts before institution hours`,
                                        details: `${teacherName}: ${slot.start_time} is before ${config.start_time}`
                                    })
                                }
                                if (slotEnd > dayEnd) {
                                    errors.push({
                                        type: 'warning',
                                        message: `Blocked slot ends after institution hours`,
                                        details: `${teacherName}: ${slot.end_time} is after ${config.end_time}`
                                    })
                                }
                                if (slotStart >= slotEnd) {
                                    errors.push({
                                        type: 'error',
                                        message: `Invalid time range for ${teacherName}`,
                                        details: `Start time ${slot.start_time} must be before end time ${slot.end_time}`
                                    })
                                }
                            }
                        })
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }
            })

            return errors
        } catch (error) {
            console.error("Validation error:", error)
            return []
        }
    }

    // Helper to get teacher name by ID
    const getTeacherNameById = (id: number) => {
        const teacher = teachers?.find((t: Teacher) => t.id === id)
        return teacher?.name || `Teacher ${id}`
    }

    // Calculate validation errors
    const validationErrors = validateConstraints()
    const hasErrors = validationErrors.some(e => e.type === 'error')
    const hasWarnings = validationErrors.some(e => e.type === 'warning')

    // Fetch data
    const { data: constraintConfigs } = useQuery({
        queryKey: ['constraintConfigs'],
        queryFn: () => constraintsApi.list().then(res => res.data),
    })

    const { data: teachers } = useQuery({
        queryKey: ['teachers'],
        queryFn: () => teachersApi.list().then(res => res.data),
    })

    const { data: datasets } = useQuery({
        queryKey: ['datasets'],
        queryFn: () => datasetsApi.list().then(res => res.data),
    })

    // Generate mutation
    const generateMutation = useMutation({
        mutationFn: () => timetablesApi.generate({
            constraint_config_id: selectedConfigId || undefined,
            teacher_constraints: teacherConstraints,
            room_constraints: [],
            locked_assignments: [],
            population_size: settings.population_size,
            generations: settings.generations,
            target_fitness: settings.target_fitness,
            random_seed: settings.random_seed,
        }),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: ['timetables'] })
            navigate(`/timetables/${response.data.timetable_id}`)
        },
    })

    // Handlers
    const handleAddConstraint = () => {
        if (!newConstraint.teacher_id) return

        const constraint: TeacherConstraint = {
            teacher_id: newConstraint.teacher_id!,
            constraint_type: newConstraint.constraint_type as ConstraintType,
            is_hard: newConstraint.is_hard || false,
            weight: newConstraint.weight || 5,
            day: newConstraint.constraint_type === 'day_off' ? undefined : newConstraint.day,
            days: newConstraint.constraint_type === 'day_off' ? [newConstraint.day!] : undefined,
            start_time: ['blocked_slot', 'available_window', 'preferred_slot'].includes(newConstraint.constraint_type!)
                ? newConstraint.start_time : undefined,
            end_time: ['blocked_slot', 'available_window', 'preferred_slot'].includes(newConstraint.constraint_type!)
                ? newConstraint.end_time : undefined,
        }

        setTeacherConstraints([...teacherConstraints, constraint])
        setShowAddConstraint(false)
        setNewConstraint({
            teacher_id: 0,
            constraint_type: 'blocked_slot',
            is_hard: false,
            weight: 5,
            day: 'Monday',
            start_time: '09:00',
            end_time: '12:00',
        })
    }

    const handleRemoveConstraint = (index: number) => {
        setTeacherConstraints(teacherConstraints.filter((_, i) => i !== index))
    }

    const getTeacherName = (id: number) => getTeacherNameById(id)

    const selectedConfig = constraintConfigs?.find((c: ConstraintConfig) => c.id === selectedConfigId)
    const defaultConfig = constraintConfigs?.find((c: ConstraintConfig) => c.is_default)

    // Check if datasets are available
    const hasDatasets = datasets && datasets.length > 0

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Page Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/20 via-primary/5 to-background/50 border border-primary/10 p-8 shadow-lg backdrop-blur-sm">
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                            <Sparkles className="h-8 w-8 text-primary" />
                            Generate Timetable
                        </h1>
                        <p className="text-muted-foreground text-lg">
                            Configure constraints and start the optimization engine
                        </p>
                    </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-48 h-48 bg-primary/5 rounded-full blur-2xl" />
            </div>

            {/* Dataset Status */}
            <Card className={cn(
                "border-2",
                hasDatasets ? "border-green-500/30 bg-green-500/5" : "border-yellow-500/30 bg-yellow-500/5"
            )}>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        {hasDatasets ? (
                            <CheckCircle className="h-8 w-8 text-green-500" />
                        ) : (
                            <AlertCircle className="h-8 w-8 text-yellow-500" />
                        )}
                        <div>
                            <p className="font-semibold text-lg">
                                {hasDatasets ? 'Datasets Ready' : 'No Datasets Uploaded'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {hasDatasets
                                    ? `${datasets.length} dataset(s) available for scheduling`
                                    : 'Please upload courses, teachers, and rooms data before generating'
                                }
                            </p>
                        </div>
                        {!hasDatasets && (
                            <Button variant="outline" className="ml-auto" onClick={() => navigate('/upload')}>
                                Upload Data
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Constraint Profile Selection */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings2 className="h-5 w-5" />
                        Constraint Profile
                    </CardTitle>
                    <CardDescription>
                        Select a constraint configuration to use for generation
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {constraintConfigs?.map((config: ConstraintConfig) => (
                            <div
                                key={config.id}
                                className={cn(
                                    "cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-md",
                                    selectedConfigId === config.id || (!selectedConfigId && config.is_default)
                                        ? "border-primary bg-primary/5 shadow-sm"
                                        : "border-border/50 hover:border-primary/50"
                                )}
                                onClick={() => setSelectedConfigId(config.id)}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <p className="font-semibold">{config.name}</p>
                                    {config.is_default && (
                                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                                            Default
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                    <p>{config.days_per_week} days/week</p>
                                    <p>{config.start_time} - {config.end_time}</p>
                                    <p>{config.timeslot_duration_minutes} min slots</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Teacher Constraints */}
            <Card>
                <CardHeader
                    className="cursor-pointer"
                    onClick={() => setExpandedSections(s => ({ ...s, constraints: !s.constraints }))}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Teacher Constraints
                                {teacherConstraints.length > 0 && (
                                    <span className="ml-2 text-sm bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                                        {teacherConstraints.length}
                                    </span>
                                )}
                            </CardTitle>
                            <CardDescription>
                                Define availability, blocked slots, and preferences for teachers
                            </CardDescription>
                        </div>
                        {expandedSections.constraints ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                    </div>
                </CardHeader>
                {expandedSections.constraints && (
                    <CardContent className="space-y-4">
                        {/* Existing Constraints List */}
                        {teacherConstraints.length > 0 && (
                            <div className="space-y-2">
                                {teacherConstraints.map((constraint, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "flex items-center justify-between p-4 rounded-lg border",
                                            constraint.is_hard
                                                ? "border-red-500/30 bg-red-500/5"
                                                : "border-yellow-500/30 bg-yellow-500/5"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            {constraint.is_hard ? (
                                                <Lock className="h-5 w-5 text-red-500" />
                                            ) : (
                                                <Unlock className="h-5 w-5 text-yellow-500" />
                                            )}
                                            <div>
                                                <p className="font-medium">
                                                    {getTeacherName(constraint.teacher_id)}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {CONSTRAINT_TYPES.find(t => t.value === constraint.constraint_type)?.label}
                                                    {constraint.day && ` - ${constraint.day}`}
                                                    {constraint.days && ` - ${constraint.days.join(', ')}`}
                                                    {constraint.start_time && ` (${constraint.start_time} - ${constraint.end_time})`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-xs px-2 py-0.5 rounded-full",
                                                constraint.is_hard
                                                    ? "bg-red-500/20 text-red-500"
                                                    : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
                                            )}>
                                                {constraint.is_hard ? 'Hard' : `Soft (w:${constraint.weight})`}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleRemoveConstraint(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Constraint Form */}
                        {showAddConstraint ? (
                            <div className="p-4 rounded-lg border border-dashed border-primary/50 bg-primary/5 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Teacher Select */}
                                    <div>
                                        <label className="text-sm font-medium mb-1.5 block">Teacher</label>
                                        <select
                                            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                            value={newConstraint.teacher_id}
                                            onChange={(e) => setNewConstraint({
                                                ...newConstraint,
                                                teacher_id: parseInt(e.target.value)
                                            })}
                                        >
                                            <option value={0}>Select teacher...</option>
                                            {teachers?.map((teacher: Teacher) => (
                                                <option key={teacher.id} value={teacher.id}>
                                                    {teacher.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Constraint Type */}
                                    <div>
                                        <label className="text-sm font-medium mb-1.5 block">Type</label>
                                        <select
                                            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                            value={newConstraint.constraint_type}
                                            onChange={(e) => setNewConstraint({
                                                ...newConstraint,
                                                constraint_type: e.target.value as ConstraintType
                                            })}
                                        >
                                            {CONSTRAINT_TYPES.map((type) => (
                                                <option key={type.value} value={type.value}>
                                                    {type.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Day */}
                                    <div>
                                        <label className="text-sm font-medium mb-1.5 block">Day</label>
                                        <select
                                            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                            value={newConstraint.day}
                                            onChange={(e) => setNewConstraint({
                                                ...newConstraint,
                                                day: e.target.value
                                            })}
                                        >
                                            {DAYS.map((day) => (
                                                <option key={day} value={day}>{day}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Hard/Soft Toggle */}
                                    <div>
                                        <label className="text-sm font-medium mb-1.5 block">Enforcement</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                className={cn(
                                                    "flex-1 h-10 px-3 rounded-md border text-sm font-medium transition-colors",
                                                    newConstraint.is_hard
                                                        ? "border-red-500 bg-red-500/10 text-red-500"
                                                        : "border-input hover:bg-muted"
                                                )}
                                                onClick={() => setNewConstraint({ ...newConstraint, is_hard: true })}
                                            >
                                                Hard
                                            </button>
                                            <button
                                                type="button"
                                                className={cn(
                                                    "flex-1 h-10 px-3 rounded-md border text-sm font-medium transition-colors",
                                                    !newConstraint.is_hard
                                                        ? "border-yellow-500 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                                        : "border-input hover:bg-muted"
                                                )}
                                                onClick={() => setNewConstraint({ ...newConstraint, is_hard: false })}
                                            >
                                                Soft
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Time Selection (for blocked_slot, available_window, preferred_slot) */}
                                {['blocked_slot', 'available_window', 'preferred_slot'].includes(newConstraint.constraint_type!) && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-sm font-medium mb-1.5 block">Start Time</label>
                                            <select
                                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                                value={newConstraint.start_time}
                                                onChange={(e) => setNewConstraint({
                                                    ...newConstraint,
                                                    start_time: e.target.value
                                                })}
                                            >
                                                {TIME_SLOTS.map((time) => (
                                                    <option key={time} value={time}>{time}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-1.5 block">End Time</label>
                                            <select
                                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                                value={newConstraint.end_time}
                                                onChange={(e) => setNewConstraint({
                                                    ...newConstraint,
                                                    end_time: e.target.value
                                                })}
                                            >
                                                {TIME_SLOTS.map((time) => (
                                                    <option key={time} value={time}>{time}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {/* Weight (for soft constraints) */}
                                        {!newConstraint.is_hard && (
                                            <div>
                                                <label className="text-sm font-medium mb-1.5 block">
                                                    Weight ({newConstraint.weight})
                                                </label>
                                                <Input
                                                    type="range"
                                                    min={1}
                                                    max={10}
                                                    value={newConstraint.weight}
                                                    onChange={(e) => setNewConstraint({
                                                        ...newConstraint,
                                                        weight: parseInt(e.target.value)
                                                    })}
                                                    className="h-10"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setShowAddConstraint(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleAddConstraint}
                                        disabled={!newConstraint.teacher_id}
                                    >
                                        Add Constraint
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                className="w-full border-dashed"
                                onClick={() => setShowAddConstraint(true)}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Teacher Constraint
                            </Button>
                        )}
                    </CardContent>
                )}
            </Card>

            {/* Optimization Settings */}
            <Card>
                <CardHeader
                    className="cursor-pointer"
                    onClick={() => setExpandedSections(s => ({ ...s, settings: !s.settings }))}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Settings2 className="h-5 w-5" />
                                Optimization Settings
                            </CardTitle>
                            <CardDescription>
                                Fine-tune the genetic algorithm parameters
                            </CardDescription>
                        </div>
                        {expandedSections.settings ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                    </div>
                </CardHeader>
                {expandedSections.settings && (
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    Population Size: {settings.population_size}
                                </label>
                                <Input
                                    type="range"
                                    min={10}
                                    max={100}
                                    value={settings.population_size}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        population_size: parseInt(e.target.value)
                                    })}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Larger = better results, slower generation
                                </p>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    Generations: {settings.generations}
                                </label>
                                <Input
                                    type="range"
                                    min={50}
                                    max={300}
                                    value={settings.generations}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        generations: parseInt(e.target.value)
                                    })}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    More iterations for better optimization
                                </p>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    Target Fitness: {settings.target_fitness}%
                                </label>
                                <Input
                                    type="range"
                                    min={50}
                                    max={100}
                                    value={settings.target_fitness}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        target_fitness: parseInt(e.target.value)
                                    })}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Stop early when this score is reached
                                </p>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    Random Seed (Optional)
                                </label>
                                <Input
                                    type="number"
                                    placeholder="e.g. 42"
                                    value={settings.random_seed || ''}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        random_seed: e.target.value ? parseInt(e.target.value) : undefined
                                    })}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Use same seed for reproducible results
                                </p>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Validation Warnings Panel */}
            {validationErrors.length > 0 && (
                <Card className={cn(
                    "border-2",
                    hasErrors ? "border-destructive/50 bg-destructive/5" : "border-yellow-500/30 bg-yellow-500/5"
                )}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <AlertCircle className={cn(
                                "h-5 w-5",
                                hasErrors ? "text-destructive" : "text-yellow-500"
                            )} />
                            {hasErrors ? 'Configuration Errors' : 'Configuration Warnings'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                            {validationErrors.map((error, index) => (
                                <li key={index} className="flex items-start gap-2 text-sm">
                                    <span className={cn(
                                        "shrink-0 mt-0.5 h-4 w-4 rounded-full flex items-center justify-center text-xs font-bold",
                                        error.type === 'error'
                                            ? "bg-destructive text-destructive-foreground"
                                            : "bg-yellow-500 text-white"
                                    )}>
                                        {error.type === 'error' ? '!' : '?'}
                                    </span>
                                    <div>
                                        <p className="font-medium">{error.message}</p>
                                        {error.details && (
                                            <p className="text-muted-foreground text-xs">{error.details}</p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {hasErrors && (
                            <p className="mt-4 text-sm text-destructive font-medium">
                                Please fix the errors above before generating.
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Generation Summary & Button */}
            <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-background">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-semibold text-lg mb-2">Ready to Generate</h3>
                            <div className="text-sm text-muted-foreground space-y-1">
                                <p>Profile: {selectedConfig?.name || defaultConfig?.name || 'Default'}</p>
                                <p>Teacher Constraints: {teacherConstraints.length} ({teacherConstraints.filter(c => c.is_hard).length} hard)</p>
                                <p>Settings: {settings.population_size} pop, {settings.generations} gen</p>
                                {hasWarnings && !hasErrors && (
                                    <p className="text-yellow-600 dark:text-yellow-400">
                                        ⚠ {validationErrors.length} warning(s) - review recommended
                                    </p>
                                )}
                            </div>
                        </div>
                        <Button
                            size="lg"
                            className="shadow-lg hover:shadow-xl transition-all min-w-[200px]"
                            disabled={!hasDatasets || generateMutation.isPending || hasErrors}
                            onClick={() => generateMutation.mutate()}
                        >
                            {generateMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-5 w-5" />
                                    Generate Timetable
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Generation Progress */}
                    {generateMutation.isPending && (
                        <div className="mt-6 p-4 rounded-lg border border-primary/30 bg-primary/5">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
                                </div>
                                <div>
                                    <p className="font-semibold">Optimizing Schedule...</p>
                                    <p className="text-sm text-muted-foreground">
                                        Our AI is finding the best slots. This may take 1-3 minutes.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {generateMutation.isError && (
                        <div className="mt-6 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                            <div className="flex items-center gap-3 text-destructive">
                                <AlertCircle className="h-5 w-5" />
                                <div className="w-full">
                                    <p className="font-semibold">Generation Failed</p>
                                    <div className="text-sm mt-1">
                                        {(() => {
                                            const errorData = (generateMutation.error as any)?.response?.data;
                                            const detail = errorData?.detail;
                                            
                                            if (typeof detail === 'string') {
                                                return detail;
                                            }
                                            
                                            if (detail && typeof detail === 'object') {
                                                if (detail.message) {
                                                     return (
                                                        <div>
                                                            <p>{detail.message}</p>
                                                            {detail.validation_errors && (
                                                                <ul className="list-disc pl-5 mt-2 space-y-1 text-xs opacity-90">
                                                                    {detail.validation_errors.errors?.map((err: any, i: number) => (
                                                                        <li key={i}>
                                                                            <span className="font-medium">{err.error_type}:</span> {err.message}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                     );
                                                }
                                                return JSON.stringify(detail);
                                            }
                                            
                                            return 'An unexpected error occurred';
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
