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
    Loader2,
    Edit2,
    Save,
    X
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { timetablesApi } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

export function Timetables() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [, setGeneratingId] = useState<number | null>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingName, setEditingName] = useState('')
    const [showGenerateDialog, setShowGenerateDialog] = useState(false)

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

    // Rename mutation
    const renameMutation = useMutation({
        mutationFn: ({ id, name }: { id: number; name: string }) => 
            timetablesApi.update(id, name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timetables'] })
            setEditingId(null)
            setEditingName('')
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
        setShowGenerateDialog(true)
    }

    const handleDelete = (id: number) => {
        if (confirm('Delete this timetable? This action cannot be undone.')) {
            deleteMutation.mutate(id)
        }
    }

    const handleExport = (id: number, format: string) => {
        exportMutation.mutate({ id, format })
    }

    const startEditing = (timetable: any) => {
        setEditingId(timetable.id)
        setEditingName(timetable.name)
    }

    const saveRename = (id: number) => {
        if (editingName.trim()) {
            renameMutation.mutate({ id, name: editingName })
        }
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
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
                                            {editingId === timetable.id ? (
                                                <div className="flex items-center gap-2 flex-1 max-w-sm">
                                                    <Input
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        className="h-8"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveRename(timetable.id)
                                                            if (e.key === 'Escape') setEditingId(null)
                                                        }}
                                                    />
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-8 w-8"
                                                        onClick={() => saveRename(timetable.id)}
                                                    >
                                                        <Save className="h-4 w-4 text-green-600" />
                                                    </Button>
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-8 w-8"
                                                        onClick={() => setEditingId(null)}
                                                    >
                                                        <X className="h-4 w-4 text-red-600" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 group">
                                                    <CardTitle className="leading-none">
                                                        {timetable.name}
                                                    </CardTitle>
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => startEditing(timetable)}
                                                    >
                                                        <Edit2 className="h-3 w-3 text-muted-foreground" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        <CardDescription className="mt-1 ml-7">
                                            {timetable.semester} {timetable.year}
                                        </CardDescription>
                                    </div>
                                    <span
                                        className={`px-3 py-1 text-xs rounded-full ml-4 ${
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
            
            {/* Generation Confirmation Modal */}
            {showGenerateDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <Card className="w-full max-w-md shadow-lg border-2">
                        <CardHeader>
                            <CardTitle>Generate New Timetable</CardTitle>
                            <CardDescription>
                                Are you sure you want to generate a new timetable?
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                This process uses a genetic algorithm to optimize the schedule. 
                                It may take a few minutes to complete depending on the complexity of your data.
                            </p>
                        </CardContent>
                        <div className="flex items-center justify-end gap-2 p-6 pt-0">
                            <Button 
                                variant="outline" 
                                onClick={() => setShowGenerateDialog(false)}
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={() => {
                                    generateMutation.mutate()
                                    setShowGenerateDialog(false)
                                }}
                            >
                                <Calendar className="mr-2 h-4 w-4" />
                                Generate
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    )
}