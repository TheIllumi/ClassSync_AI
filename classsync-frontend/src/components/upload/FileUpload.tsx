import { useState, useCallback } from 'react'
import { Upload, X, FileText, CheckCircle, AlertCircle, LibraryBig, School } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface FileUploadProps {
    onUpload: (file: File, type: string) => void
    isUploading?: boolean
}

export function FileUpload({ onUpload, isUploading }: FileUploadProps) {
    const [dragActive, setDragActive] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [datasetType, setDatasetType] = useState<'courses' | 'rooms'>('courses')

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setSelectedFile(e.dataTransfer.files[0])
        }
    }, [])

    const handleFileSelect = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.csv'
        input.onchange = (e) => {
            const target = e.target as HTMLInputElement
            if (target.files && target.files[0]) {
                setSelectedFile(target.files[0])
            }
        }
        input.click()
    }

    const handleUpload = () => {
        if (selectedFile) {
            onUpload(selectedFile, datasetType)
        }
    }

    const handleClear = () => {
        setSelectedFile(null)
    }

    return (
        <div className="space-y-6">
            {/* Drop Zone */}
            <Card
                className={cn(
                    "border-2 border-dashed transition-all",
                    dragActive ? "border-primary bg-primary/5" : "border-border",
                    selectedFile ? "bg-accent/10" : ""
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <CardContent className="flex flex-col items-center justify-center py-12">
                    {!selectedFile ? (
                        <>
                            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-lg font-medium mb-2">
                                Drop your CSV file here
                            </p>
                            <p className="text-sm text-muted-foreground mb-4">
                                Supports Course and Room datasets
                            </p>
                            <Button
                                variant="secondary"
                                onClick={handleFileSelect}
                                disabled={isUploading}
                            >
                                Select File
                            </Button>
                        </>
                    ) : (
                        <div className="w-full max-w-md space-y-4">
                            {/* File Info */}
                            <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
                                <div className="flex items-center gap-3">
                                    <FileText className="h-8 w-8 text-primary" />
                                    <div>
                                        <p className="font-medium truncate max-w-[200px]">{selectedFile.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {(selectedFile.size / 1024).toFixed(2)} KB
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleClear}
                                    disabled={isUploading}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Type Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Dataset Type</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant={datasetType === 'courses' ? 'default' : 'outline'}
                                        onClick={() => setDatasetType('courses')}
                                        disabled={isUploading}
                                        className="h-auto py-3 flex flex-col gap-1"
                                    >
                                        <LibraryBig className="h-6 w-6 mb-1" />
                                        <span>Courses</span>
                                    </Button>
                                    <Button
                                        variant={datasetType === 'rooms' ? 'default' : 'outline'}
                                        onClick={() => setDatasetType('rooms')}
                                        disabled={isUploading}
                                        className="h-auto py-3 flex flex-col gap-1"
                                    >
                                        <School className="h-6 w-6 mb-1" />
                                        <span>Rooms</span>
                                    </Button>
                                </div>
                            </div>

                            <Button
                                className="w-full"
                                onClick={handleUpload}
                                disabled={isUploading}
                            >
                                {isUploading ? 'Uploading...' : 'Upload Dataset'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Requirements Guide */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">CSV Format Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Courses Requirements */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 font-medium text-primary">
                                <LibraryBig className="h-5 w-5" />
                                <h3>Courses Dataset</h3>
                            </div>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p className="flex items-start gap-2">
                                    <CheckCircle className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                                    <span>Required: course_name, instructor, section, program, type, hours_per_week</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <CheckCircle className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                                    <span>Type: "Lab" or "Theory"</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                    <span>Optional: course_code, capacity (default: 50)</span>
                                </p>
                            </div>
                        </div>

                        {/* Rooms Requirements */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 font-medium text-primary">
                                <School className="h-5 w-5" />
                                <h3>Rooms Dataset</h3>
                            </div>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p className="flex items-start gap-2">
                                    <CheckCircle className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                                    <span>Required: rooms, type</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <CheckCircle className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                                    <span>Type: "Lab" or "Theory"</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                    <span>Optional: capacity (default: 50)</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}