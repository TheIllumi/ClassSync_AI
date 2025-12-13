import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    Calendar,
    Download,
    Trash2,
    Eye,
    Clock,
    CheckCircle,
    AlertCircle,
    Loader2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { timetablesApi } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

export function Timetables() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [, setGeneratingId] = useState<number | null>(null)

    // Fetch timetables
    const { data: timetables, isLoading } = useQuery({
        queryKey: ['timetables'],
        queryFn: () => timetablesApi.list().then(res => res.data),
    })

    // Generate mutation
    const generateMutation = useMutation({
        mutationFn: () => timetablesApi.generate(),
        onMutate: () => {
            setGeneratingId(-1) // Temporary ID for new generation
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timetables'] })
            setGeneratingId(null)
        },
        onError: () => {
            setGeneratingId(null)
        },
    })

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id: number) => timetablesApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timetables'] })
        },
    })

    // Export mutation
    const exportMutation = useMutation({
        mutationFn: ({ id, format }: { id: number; format: string }) =>
            timetablesApi.export(id, format, 'master'),
        onSuccess: (response, variables) => {
            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `timetable_${variables.id}.${variables.format}`)
            document.body.appendChild(link)
            link.click()
            link.remove()
        },
    })

    const handleGenerate = () => {
        if (confirm('Generate a new timetable? This may take a few minutes.')) {
            generateMutation.mutate()
        }
    }

    const handleDelete = (id: number) => {
        if (confirm('Delete this timetable? This action cannot be undone.')) {
            deleteMutation.mutate(id)
        }
    }

    const handleExport = (id: number, format: string) => {
        exportMutation.mutate({ id, format })
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Timetables</h1>
                    <p className="text-muted-foreground mt-1">
                        View and manage generated timetables
                    </p>
                </div>
                <Button
                    onClick={handleGenerate}
                    disabled={generateMutation.isPending}
                    size="lg"
                >
                    {generateMutation.isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Calendar className="mr-2 h-4 w-4" />
                            Generate New
                        </>
                    )}
                </Button>
            </div>

            {/* Generation Progress */}
            {generateMutation.isPending && (
                <Card className="border-primary">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <div>
                                <p className="font-medium">Generating timetable...</p>
                                <p className="text-sm text-muted-foreground">
                                    This may take 2-3 minutes. Please wait.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Timetables List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : timetables && timetables.length > 0 ? (
                <div className="grid gap-4">
                    {timetables.map((timetable: any) => (
                        <Card key={timetable.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Calendar className="h-5 w-5 text-primary" />
                                            {timetable.name}
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            {timetable.semester} {timetable.year}
                                        </CardDescription>
                                    </div>
                                    <span
                                        className={`px-3 py-1 text-xs rounded-full ${
                                            timetable.status === 'COMPLETED'
                                                ? 'bg-accent/20 text-accent'
                                                : timetable.status === 'FAILED'
                                                    ? 'bg-destructive/20 text-destructive'
                                                    : 'bg-secondary/20 text-secondary'
                                        }`}
                                    >
                    {timetable.status}
                  </span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Generation Time</p>
                                            <p className="text-sm font-medium">
                                                {timetable.generation_time_seconds.toFixed(1)}s
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Score</p>
                                            <p className="text-sm font-medium">
                                                {timetable.constraint_score}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Conflicts</p>
                                            <p className="text-sm font-medium">
                                                {timetable.conflict_count}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Created</p>
                                            <p className="text-sm font-medium">
                                                {formatDateTime(timetable.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`/timetables/${timetable.id}`)}
                                    >
                                        <Eye className="mr-2 h-4 w-4" />
                                        View
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleExport(timetable.id, 'xlsx')}
                                        disabled={exportMutation.isPending}
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Export XLSX
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleExport(timetable.id, 'csv')}
                                        disabled={exportMutation.isPending}
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Export CSV
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(timetable.id)}
                                        disabled={deleteMutation.isPending}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium mb-2">No timetables yet</p>
                        <p className="text-sm text-muted-foreground mb-6">
                            Generate your first timetable to get started
                        </p>
                        <Button onClick={handleGenerate}>
                            <Calendar className="mr-2 h-4 w-4" />
                            Generate Timetable
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}