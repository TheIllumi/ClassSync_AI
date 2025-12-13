import { useState, useCallback } from 'react'
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
            // Don't clear the file immediately - let the parent handle success
        }
    }

    const handleClear = () => {
        setSelectedFile(null)
    }

    return (
        <div className="space-y-6">
            {/* Dataset Type Selection */}
            <div className="flex gap-4">
                <Button
                    variant={datasetType === 'courses' ? 'default' : 'outline'}
                    onClick={() => setDatasetType('courses')}
                    className="flex-1"
                    disabled={isUploading}
                >
                    📚 Courses Dataset
                </Button>
                <Button
                    variant={datasetType === 'rooms' ? 'default' : 'outline'}
                    onClick={() => setDatasetType('rooms')}
                    className="flex-1"
                    disabled={isUploading}
                >
                    🏫 Rooms Dataset
                </Button>
            </div>

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
                                or click to browse
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
                        <div className="w-full max-w-md">
                            <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                                <div className="flex items-center gap-3">
                                    <FileText className="h-8 w-8 text-primary" />
                                    <div>
                                        <p className="font-medium">{selectedFile.name}</p>
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

                            <Button
                                className="w-full mt-4"
                                onClick={handleUpload}
                                disabled={isUploading}
                            >
                                {isUploading ? 'Uploading...' : 'Upload Dataset'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Requirements */}
            <Card>
                <CardContent className="pt-6">
                    <h3 className="font-semibold mb-3">CSV Format Requirements</h3>

                    {datasetType === 'courses' ? (
                        <div className="space-y-2 text-sm">
                            <p className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-accent mt-0.5" />
                                <span>Required columns: course_name, instructor, section, program, type, hours_per_week</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-accent mt-0.5" />
                                <span>Type: "Lab" or "Theory"</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <span>Optional: course_code, capacity (defaults: auto-generated, 50)</span>
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2 text-sm">
                            <p className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-accent mt-0.5" />
                                <span>Required columns: rooms, type</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-accent mt-0.5" />
                                <span>Type: "Lab" or "Theory"</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <span>Optional: capacity (default: 50)</span>
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}