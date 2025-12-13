import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUpload } from '@/components/upload/FileUpload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { datasetsApi } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { Trash2, CheckCircle, XCircle, FileInput } from 'lucide-react'

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

            // Force page refresh to show new dataset
            // setTimeout(() => { window.location.reload() }, 1000),
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
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Upload Datasets</h1>
                <p className="text-muted-foreground mt-1">
                    Upload your course and room data in CSV format
                </p>
            </div>

            {/* Upload Status */}
            {uploadStatus && (
                <Card className={uploadStatus.success ? 'border-accent' : 'border-destructive'}>
                    <CardContent className="flex items-center gap-3 pt-6">
                        {uploadStatus.success ? (
                            <CheckCircle className="h-5 w-5 text-accent" />
                        ) : (
                            <XCircle className="h-5 w-5 text-destructive" />
                        )}
                        <p className="text-sm">{uploadStatus.message}</p>
                    </CardContent>
                </Card>
            )}

            {/* File Upload */}
            <FileUpload
                onUpload={handleUpload}
                isUploading={uploadMutation.isPending}
            />

            {/* Uploaded Datasets */}
            <Card>
                <CardHeader>
                    <CardTitle>Uploaded Datasets</CardTitle>
                    <CardDescription>Previously uploaded files</CardDescription>
                </CardHeader>
                <CardContent>
                    {datasets && datasets.length > 0 ? (
                        <div className="space-y-2">
                            {datasets.map((dataset: any) => (
                                <div
                                    key={dataset.id}
                                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {dataset.dataset_type === 'courses' ? (
                            <span className="text-xl">📚</span>
                        ) : (
                            <FileInput className="h-5 w-5 text-muted-foreground" />
                        )}
                      </span>
                                            <div>
                                                <p className="font-medium">{dataset.file_name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {dataset.row_count} rows • Uploaded {formatDateTime(dataset.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                    <span
                        className={`px-3 py-1 text-xs rounded-full ${
                            dataset.validation_status === 'valid'
                                ? 'bg-accent/20 text-accent'
                                : 'bg-destructive/20 text-destructive'
                        }`}
                    >
                      {dataset.validation_status}
                    </span>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => deleteMutation.mutate(dataset.id)}
                                            disabled={deleteMutation.isPending}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">
                            No datasets uploaded yet
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}