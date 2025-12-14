import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Calendar, Clock, Users, Building, GraduationCap, MapPin, UserRound, Plus, Minus, ChevronDown, Edit2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { timetablesApi } from '@/lib/api'
import { cn } from '@/lib/utils'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

// Color palette for different courses (pastel colors matching your theme)
const COURSE_COLORS = [
    'bg-blue-100 border-blue-300 text-blue-900',
    'bg-purple-100 border-purple-300 text-purple-900',
    'bg-pink-100 border-pink-300 text-pink-900',
    'bg-green-100 border-green-300 text-green-900',
    'bg-yellow-100 border-yellow-300 text-yellow-900',
    'bg-indigo-100 border-indigo-300 text-indigo-900',
    'bg-red-100 border-red-300 text-red-900',
    'bg-teal-100 border-teal-300 text-teal-900',
    'bg-orange-100 border-orange-300 text-orange-900',
    'bg-cyan-100 border-cyan-300 text-cyan-900',
]

const PIXELS_PER_30_MIN = 100

interface TimetableEntry {
    id: number
    day_of_week: number
    start_time: string
    end_time: string
    course: { id: number; name: string; code: string }
    teacher: { id: number; name: string }
    room: { id: number; code: string; name: string }
    section: { id: number; code: string; name: string }
}

interface TimeSlot {
    time: string
    minutesFromStart: number
}

interface OverlapGroup {
    entries: TimetableEntry[]
    startRow: number
    endRow: number
}

export function TimetableView() {
    const { id } = useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [zoomLevel, setZoomLevel] = useState(1)
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editingName, setEditingName] = useState('')

    const { data: timetable, isLoading } = useQuery({
        queryKey: ['timetable', id],
        queryFn: () => timetablesApi.get(Number(id)).then(res => res.data),
    })

    // Initialize editing name when timetable loads
    useEffect(() => {
        if (timetable) {
            setEditingName(timetable.name)
        }
    }, [timetable])

    const renameMutation = useMutation({
        mutationFn: ({ id, name }: { id: number; name: string }) => 
            timetablesApi.update(id, name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timetable', id] })
            setIsEditing(false)
        },
    })

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2))
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.1))

    const handleExport = async (viewType: string) => {
        try {
            const response = await timetablesApi.export(Number(id), 'xlsx', viewType)
            
            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `${timetable.name.replace(/\s+/g, '_')}_${viewType}.xlsx`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            setIsExportMenuOpen(false)
        } catch (error) {
            console.error('Export failed:', error)
            alert('Failed to export timetable')
        }
    }
    
    const handleSaveRename = () => {
        if (editingName.trim()) {
            renameMutation.mutate({ id: Number(id), name: editingName })
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
                    <p className="text-muted-foreground">Loading timetable...</p>
                </div>
            </div>
        )
    }

    if (!timetable) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Timetable not found</p>
            </div>
        )
    }

    // Helpers
    const timeToMinutes = (time: string): number => {
        const [hours, minutes] = time.split(':').map(Number)
        return hours * 60 + minutes
    }

    const formatTime12Hour = (time: string): string => {
        const [hours, minutes] = time.split(':').map(Number)
        const period = hours >= 12 ? 'PM' : 'AM'
        const displayHours = hours % 12 || 12
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
    }

    const findTimeRange = (entries: TimetableEntry[]): { start: number; end: number } => {
        if (!entries || entries.length === 0) return { start: 8 * 60, end: 18 * 60 + 30 }

        let earliest = Infinity
        let latest = -Infinity
        entries.forEach(entry => {
            const s = timeToMinutes(entry.start_time)
            const e = timeToMinutes(entry.end_time)
            earliest = Math.min(earliest, s)
            latest = Math.max(latest, e)
        })
        earliest = Math.floor(earliest / 30) * 30
        latest = Math.ceil(latest / 30) * 30
        return { start: earliest, end: latest }
    }

    const generateTimeSlots = (startMinutes: number, endMinutes: number): TimeSlot[] => {
        const slots: TimeSlot[] = []
        for (let minutes = startMinutes; minutes <= endMinutes; minutes += 30) {
            const hours = Math.floor(minutes / 60)
            const mins = minutes % 60
            const time = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
            slots.push({ time, minutesFromStart: minutes - startMinutes })
        }
        return slots
    }

    const timeRange = findTimeRange(timetable.entries || [])
    const timeSlots = generateTimeSlots(timeRange.start, timeRange.end)

    const timesOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
        const s1 = timeToMinutes(start1)
        const e1 = timeToMinutes(end1)
        const s2 = timeToMinutes(start2)
        const e2 = timeToMinutes(end2)
        return s1 < e2 && s2 < e1
    }

    const groupOverlappingEntries = (entries: TimetableEntry[]): OverlapGroup[] => {
        if (entries.length === 0) return []

        const sorted = [...entries].sort(
            (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
        )

        const groups: OverlapGroup[] = []
        let currentGroup: TimetableEntry[] = [sorted[0]]

        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i]
            const overlaps = currentGroup.some(entry =>
                timesOverlap(entry.start_time, entry.end_time, current.start_time, current.end_time)
            )
            if (overlaps) {
                currentGroup.push(current)
            } else {
                const startRow =
                    Math.floor((timeToMinutes(currentGroup[0].start_time) - timeRange.start) / 30) + 1
                const maxEnd = Math.max(...currentGroup.map(e => timeToMinutes(e.end_time)))
                const endRow = Math.ceil((maxEnd - timeRange.start) / 30) + 1
                groups.push({ entries: currentGroup, startRow, endRow })
                currentGroup = [current]
            }
        }

        if (currentGroup.length > 0) {
            const startRow =
                Math.floor((timeToMinutes(currentGroup[0].start_time) - timeRange.start) / 30) + 1
            const maxEnd = Math.max(...currentGroup.map(e => timeToMinutes(e.end_time)))
            const endRow = Math.ceil((maxEnd - timeRange.start) / 30) + 1
            groups.push({ entries: currentGroup, startRow, endRow })
        }

        return groups
    }

    // Organize by day
    const entriesByDay: Record<number, TimetableEntry[]> = {}
    DAYS.forEach((_, idx) => (entriesByDay[idx] = []))
    timetable.entries?.forEach((entry: TimetableEntry) => {
        if (!entriesByDay[entry.day_of_week]) entriesByDay[entry.day_of_week] = []
        entriesByDay[entry.day_of_week].push(entry)
    })

    // Max concurrent per day
    const maxConcurrentByDay: Record<number, number> = {}
    DAYS.forEach((_, idx) => {
        const groups = groupOverlappingEntries(entriesByDay[idx] || [])
        maxConcurrentByDay[idx] = Math.max(1, ...groups.map(g => g.entries.length))
    })

    // Course colors
    const courseColors = new Map<string, string>()
    let colorIndex = 0
    const getColorForCourse = (courseCode: string): string => {
        if (!courseColors.has(courseCode)) {
            courseColors.set(courseCode, COURSE_COLORS[colorIndex % COURSE_COLORS.length])
            colorIndex++
        }
        return courseColors.get(courseCode)!
    }

    // Grid row positioning
    const getGridRowPosition = (startTime: string, endTime: string) => {
        const startMinutes = timeToMinutes(startTime) - timeRange.start
        const endMinutes = timeToMinutes(endTime) - timeRange.start
        const startRow = Math.floor(startMinutes / 30) + 1
        const endRow = Math.ceil(endMinutes / 30) + 1
        return { startRow, endRow }
    }
    
    // Zoomed values
    const currentPixelsPer30Min = PIXELS_PER_30_MIN * zoomLevel
    const minColumnWidth = 200 * zoomLevel

    return (
        <div className="space-y-6">
            {/* Top Page Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/timetables')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    className="h-10 text-2xl font-bold w-[300px]"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveRename()
                                        if (e.key === 'Escape') setIsEditing(false)
                                    }}
                                />
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={handleSaveRename}
                                >
                                    <Save className="h-5 w-5 text-green-600" />
                                </Button>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => setIsEditing(false)}
                                >
                                    <X className="h-5 w-5 text-red-600" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group">
                                <h1 className="text-3xl font-bold tracking-tight">{timetable.name}</h1>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => setIsEditing(true)}
                                >
                                    <Edit2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>
                        )}
                        <p className="text-muted-foreground mt-1">
                            {timetable.semester} {timetable.year}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 relative">
                    <div className="relative">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                            className="min-w-[140px] justify-between"
                        >
                            <span className="flex items-center">
                                <Download className="mr-2 h-4 w-4" />
                                Export
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>

                        {isExportMenuOpen && (
                            <>
                                <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={() => setIsExportMenuOpen(false)}
                                />
                                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-popover text-popover-foreground ring-1 ring-black ring-opacity-5 z-50 border border-border">
                                    <div className="py-1" role="menu">
                                        <button
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                                            onClick={() => handleExport('master')}
                                        >
                                            Master View
                                        </button>
                                        <button
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                                            onClick={() => handleExport('section')}
                                        >
                                            By Section
                                        </button>
                                        <button
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                                            onClick={() => handleExport('teacher')}
                                        >
                                            By Teacher
                                        </button>
                                        <button
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                                            onClick={() => handleExport('room')}
                                        >
                                            By Room
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            <div>
                                <p className="text-2xl font-bold">{timetable.entries?.length || 0}</p>
                                <p className="text-xs text-muted-foreground">Total Classes</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-secondary" />
                            <div>
                                <p className="text-2xl font-bold">
                                    {timetable.generation_time_seconds.toFixed(1)}s
                                </p>
                                <p className="text-xs text-muted-foreground">Generation Time</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-accent" />
                            <div>
                                <p className="text-2xl font-bold">{timetable.constraint_score}</p>
                                <p className="text-xs text-muted-foreground">Score</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-destructive" />
                            <div>
                                <p className="text-2xl font-bold">{timetable.conflict_count}</p>
                                <p className="text-xs text-muted-foreground">Conflicts</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Weekly Timetable Grid */}
            <Card className="overflow-hidden">
                <CardHeader className="bg-card rounded-t-lg border-b flex flex-row items-center justify-between space-y-0 p-4">
                    <CardTitle>Weekly Schedule</CardTitle>
                    <div className="flex items-center bg-muted/30 rounded-lg p-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} disabled={zoomLevel <= 0.1}>
                            <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center text-sm font-medium">{Math.round(zoomLevel * 100)}%</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn} disabled={zoomLevel >= 2}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-auto h-[calc(100vh-250px)]">
                        <div className="min-w-[1400px]">
                            {/* Sticky Header Row - Separate from grid */}
                            <div
                                className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-md"
                                style={{
                                    display: 'grid',
                                    gap: '8px',
                                    padding: '8px',
                                    gridTemplateColumns: `70px ${DAYS.map((_, dayIndex) =>
                                        `repeat(${maxConcurrentByDay[dayIndex]}, minmax(${minColumnWidth}px, 1fr))`
                                    ).join(' ')}`,
                                }}
                            >
                                {/* Time header cell */}
                                <div className="sticky left-0 z-50 font-semibold text-sm text-muted-foreground p-3 bg-background/95 backdrop-blur border-r rounded-l-lg flex items-center justify-end shadow-sm">
                                    Time
                                </div>

                                {/* Day headers */}
                                {DAYS.map((day, dayIndex) => (
                                    <div
                                        key={day}
                                        className="font-semibold text-sm text-center p-3 bg-primary/10 rounded-lg"
                                        style={{
                                            gridColumn: `span ${maxConcurrentByDay[dayIndex]}`,
                                        }}
                                    >
                                        {day}
                                        {maxConcurrentByDay[dayIndex] > 1 && (
                                            <span className="ml-2 text-xs opacity-60">
                                                ({maxConcurrentByDay[dayIndex]} tracks)
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Main Grid - Time slots and classes */}
                            <div
                                className="grid gap-2 p-2"
                                style={{
                                    gridTemplateColumns: `70px ${DAYS.map((_, dayIndex) =>
                                        `repeat(${maxConcurrentByDay[dayIndex]}, minmax(${minColumnWidth}px, 1fr))`
                                    ).join(' ')}`,
                                }}
                            >
                                {/* Time slots column */}
                                <div
                                    className="grid gap-0 sticky left-0 z-30 bg-background border-r shadow-sm"
                                    style={{
                                        gridTemplateRows: `repeat(${timeSlots.length}, ${currentPixelsPer30Min}px)`,
                                    }}
                                >
                                    {timeSlots.map((slot, index) => (
                                        <div
                                            key={slot.time}
                                            className={cn(
                                                'px-3 py-2 text-xs text-muted-foreground text-right font-medium border-b border-border/50 bg-background/95',
                                                index === 0 && 'rounded-tl-lg'
                                            )}
                                        >
                                            {slot.time}
                                        </div>
                                    ))}
                                </div>

                                {/* Day columns */}
                                {DAYS.map((day, dayIndex) => {
                                    const dayEntries = entriesByDay[dayIndex] || []
                                    const overlapGroups = groupOverlappingEntries(dayEntries)
                                    const maxConcurrent = maxConcurrentByDay[dayIndex]

                                    return (
                                        <div
                                            key={day}
                                            className="relative border-l border-border/30"
                                            style={{
                                                gridColumn: `span ${maxConcurrent}`,
                                                display: 'grid',
                                                gridTemplateColumns: `repeat(${maxConcurrent}, 1fr)`,
                                                gridTemplateRows: `repeat(${timeSlots.length}, ${currentPixelsPer30Min}px)`,
                                                gap: '0',
                                            }}
                                        >
                                            {/* Background grid lines */}
                                            {timeSlots.map((_, slotIndex) => (
                                                <div
                                                    key={slotIndex}
                                                    className="border-b border-border/30 bg-background"
                                                    style={{
                                                        gridColumn: `1 / span ${maxConcurrent}`,
                                                        gridRow: `${slotIndex + 1}`,
                                                    }}
                                                />
                                            ))}

                                            {/* Class blocks */}
                                            {overlapGroups.map((group, groupIndex) =>
                                                group.entries.map((entry, entryIndex) => {
                                                    const { startRow, endRow } = getGridRowPosition(
                                                        entry.start_time,
                                                        entry.end_time
                                                    )
                                                    const color = getColorForCourse(entry.course.code)

                                                    return (
                                                        <div
                                                            key={`${entry.id}-${groupIndex}-${entryIndex}`}
                                                            className={cn(
                                                                'm-1 rounded-lg border-2 p-3 transition-all hover:shadow-lg hover:scale-[1.02] hover:z-10 cursor-pointer',
                                                                color
                                                            )}
                                                            style={{
                                                                gridColumn: `${entryIndex + 1}`,
                                                                gridRow: `${startRow} / ${endRow}`,
                                                                fontSize: `${12 * zoomLevel}px`
                                                            }}
                                                            title={`${entry.course.name}\n${entry.section.name}\n${entry.teacher.name}\n${entry.room.code}\n${formatTime12Hour(
                                                                entry.start_time
                                                            )} - ${formatTime12Hour(entry.end_time)}`}
                                                        >
                                                            <p className="font-bold text-[1.15em] leading-tight mb-1 line-clamp-2">
                                                                {entry.course.name}
                                                            </p>
                                                            <p className="text-[0.9em] font-semibold opacity-90 mb-1">
                                                                Sec {entry.section.code}
                                                            </p>
                                                            <div className="flex items-center gap-1 text-[0.85em] opacity-85 line-clamp-1 mb-0.5">
                                                                <GraduationCap className="h-[1em] w-[1em] shrink-0" />
                                                                <span>{entry.section.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[0.85em] opacity-80 line-clamp-1 mb-0.5">
                                                                <UserRound className="h-[1em] w-[1em] shrink-0" />
                                                                <span>{entry.teacher.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[0.85em] opacity-75 line-clamp-1 mb-0.5">
                                                                <MapPin className="h-[1em] w-[1em] shrink-0" />
                                                                <span>{entry.room.code}</span>
                                                            </div>
                                                            <p className="text-[0.8em] opacity-70 mt-2 pt-2 border-t border-current/20">
                                                                {formatTime12Hour(entry.start_time)} -{' '}
                                                                {formatTime12Hour(entry.end_time)}
                                                            </p>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Legend */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Course Legend</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {Array.from(courseColors.entries())
                            .sort((a, b) => a[0].localeCompare(b[0]))
                            .map(([courseCode, color]) => {
                                const course = timetable.entries?.find(
                                    (e: TimetableEntry) => e.course.code === courseCode
                                )
                                return (
                                    <div key={courseCode} className="flex items-center gap-2">
                                        <div className={cn('w-4 h-4 rounded border-2 flex-shrink-0', color)} />
                                        <div className="min-w-0">
                                            <span className="text-sm font-medium block">{courseCode}</span>
                                            <span className="text-xs text-muted-foreground block truncate">
                                                {course?.course.name}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}