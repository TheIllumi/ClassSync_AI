import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUpload } from '@/components/upload/FileUpload'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { datasetsApi } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { Trash2, CheckCircle, XCircle, LibraryBig, School, Database, FileSpreadsheet } from 'lucide-react'

export function Upload() {
    const queryClient = useQueryClient()
    const [uploadStatus, setUploadStatus] = useState<{
        success: boolean
        message: string
    } | null>(null)

    // Fetch existing datasets
    const { data: datasets } = useQuery({
        queryKey: ['datasets'],
        queryFn: () => datasetsApi.list().then(res => res.data),
    })

    // Upload mutation
    const uploadMutation = useMutation({
        mutationFn: ({ file, type }: { file: File; type: string }) =>
            datasetsApi.upload(file, type),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: ['datasets'] })
            setUploadStatus({
                success: true,
                message: `Successfully uploaded ${response.data.file_name}`,
            })
            setTimeout(() => setUploadStatus(null), 5000)
        },
        onError: (error: any) => {
            setUploadStatus({
                success: false,
                message: error.response?.data?.detail || 'Upload failed',
            })
            setTimeout(() => setUploadStatus(null), 5000)
        },
    })

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id: number) => datasetsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['datasets'] })
        },
    })

    const handleUpload = (file: File, type: string) => {
        uploadMutation.mutate({ file, type })
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-background border border-indigo-500/10 p-8 shadow-sm">
                <div className="relative z-10 flex items-center gap-6">
                    <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shadow-sm ring-1 ring-indigo-500/20">
                        <Database className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            Dataset Management
                        </h1>
                        <p className="text-muted-foreground text-lg max-w-2xl">
                            Upload and manage your institutional data. Ensure your CSV files follow the required format for optimal scheduling.
                        </p>
                    </div>
                </div>
                {/* Decorative background element */}
                <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/2 rounded-full bg-indigo-500/5 blur-3xl" />
            </div>

            {/* Upload Status Toast */}
            {uploadStatus && (
                <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 animate-in slide-in-from-right duration-300 ${
                    uploadStatus.success 
                        ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-900/50 dark:text-green-300' 
                        : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-900/50 dark:text-red-300'
                }`}>
                    {uploadStatus.success ? (
                        <CheckCircle className="h-5 w-5" />
                    ) : (
                        <XCircle className="h-5 w-5" />
                    )}
                    <p className="font-medium text-sm">{uploadStatus.message}</p>
                </div>
            )}

            {/* Main Content Area */}
            <div className="space-y-10">
                {/* File Upload Component */}
                <section>
                    <FileUpload
                        onUpload={handleUpload}
                        isUploading={uploadMutation.isPending}
                    />
                </section>

                {/* Uploaded Datasets List */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight">Uploaded Files</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Manage your active datasets for timetable generation
                            </p>
                        </div>
                        <div className="bg-muted px-3 py-1 rounded-full text-xs font-medium text-muted-foreground">
                            {datasets?.length || 0} files total
                        </div>
                    </div>

                    <Card className="overflow-hidden border-none shadow-sm bg-card/50">
                        <CardContent className="p-0">
                            {datasets && datasets.length > 0 ? (
                                <div className="divide-y divide-border/50">
                                    {datasets.map((dataset: any) => (
                                        <div
                                            key={dataset.id}
                                            className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-muted/30 transition-all duration-200"
                                        >
                                            <div className="flex items-start gap-4 mb-4 sm:mb-0">
                                                <div className={`p-3 rounded-xl ${
                                                    dataset.dataset_type === 'courses' 
                                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                                                        : 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400'
                                                }`}>
                                                    {dataset.dataset_type === 'courses' ? (
                                                        <LibraryBig className="h-6 w-6" />
                                                    ) : (
                                                        <School className="h-6 w-6" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-semibold text-base">{dataset.file_name}</h3>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                            dataset.validation_status === 'valid'
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>
                                                            {dataset.validation_status}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1.5">
                                                            <FileSpreadsheet className="h-3.5 w-3.5" />
                                                            {dataset.row_count} rows
                                                        </span>
                                                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                                        <span>Uploaded {formatDateTime(dataset.created_at)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <Button variant="outline" size="sm" className="hidden sm:flex">
                                                    View Data
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        if (confirm('Are you sure you want to delete this dataset? This action cannot be undone.')) {
                                                            deleteMutation.mutate(dataset.id)
                                                        }
                                                    }}
                                                    disabled={deleteMutation.isPending}
                                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="bg-muted/30 p-6 rounded-full mb-4">
                                        <Database className="h-10 w-10 text-muted-foreground/50" />
                                    </div>
                                    <h3 className="font-semibold text-lg">No datasets uploaded</h3>
                                    <p className="text-muted-foreground text-sm max-w-sm mt-2">
                                        Upload your Course and Room data above to get started with timetable generation.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </section>
            </div>
        </div>
    )
}