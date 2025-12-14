import { useState, useCallback } from 'react'
import { Upload, X, FileText, CheckCircle, AlertCircle, LibraryBig, School, ArrowRight } from 'lucide-react'
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
        }
    }

    const handleClear = () => {
        setSelectedFile(null)
    }

    return (
        <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column: Upload Area */}
            <div className="lg:col-span-2 space-y-6">
                <Card
                    className={cn(
                        "relative overflow-hidden border-2 border-dashed transition-all duration-300",
                        dragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20",
                        selectedFile ? "border-solid border-primary/20 bg-background" : ""
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        {!selectedFile ? (
                            <div className="space-y-4">
                                <div className={cn(
                                    "mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 transition-transform duration-500",
                                    dragActive && "scale-110"
                                )}>
                                    <Upload className="h-10 w-10 text-primary" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-semibold tracking-tight">
                                        Upload your dataset
                                    </h3>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                        Drag and drop your CSV file here, or click to browse files
                                    </p>
                                </div>
                                <Button
                                    size="lg"
                                    onClick={handleFileSelect}
                                    disabled={isUploading}
                                    className="mt-4 shadow-md hover:shadow-lg transition-all"
                                >
                                    Select File
                                </Button>
                            </div>
                        ) : (
                            <div className="w-full max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-300">
                                {/* File Info Card */}
                                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                                            <FileText className="h-6 w-6" />
                                        </div>
                                        <div className="min-w-0 text-left">
                                            <p className="font-medium truncate">{selectedFile.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {(selectedFile.size / 1024).toFixed(2)} KB
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleClear}
                                        disabled={isUploading}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                    </Button>
                                </div>

                                {/* Dataset Type Selection Cards */}
                                <div className="space-y-3 text-left">
                                    <label className="text-sm font-medium text-muted-foreground ml-1">
                                        Select Dataset Type
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div
                                            className={cn(
                                                "cursor-pointer rounded-xl border-2 p-4 transition-all hover:bg-muted/50",
                                                datasetType === 'courses'
                                                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                                    : "border-transparent bg-muted/30 hover:border-border"
                                            )}
                                            onClick={() => setDatasetType('courses')}
                                        >
                                            <LibraryBig className={cn("h-6 w-6 mb-3", datasetType === 'courses' ? "text-primary" : "text-muted-foreground")} />
                                            <p className="font-medium text-sm">Courses</p>
                                            <p className="text-xs text-muted-foreground mt-1">Lecture & Lab Data</p>
                                        </div>
                                        <div
                                            className={cn(
                                                "cursor-pointer rounded-xl border-2 p-4 transition-all hover:bg-muted/50",
                                                datasetType === 'rooms'
                                                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                                    : "border-transparent bg-muted/30 hover:border-border"
                                            )}
                                            onClick={() => setDatasetType('rooms')}
                                        >
                                            <School className={cn("h-6 w-6 mb-3", datasetType === 'rooms' ? "text-primary" : "text-muted-foreground")} />
                                            <p className="font-medium text-sm">Rooms</p>
                                            <p className="text-xs text-muted-foreground mt-1">Venue Capacity</p>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    className="w-full h-12 text-base shadow-lg hover:shadow-xl transition-all"
                                    onClick={handleUpload}
                                    disabled={isUploading}
                                >
                                    {isUploading ? (
                                        <div className="flex items-center gap-2">
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Processing...
                                        </div>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            Upload Dataset <ArrowRight className="h-4 w-4" />
                                        </span>
                                    )}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Requirements & Tips */}
            <div className="space-y-6">
                <Card className="bg-muted/30 border-none shadow-none">
                    <CardContent className="pt-6 space-y-6">
                        <div>
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <LibraryBig className="h-4 w-4 text-primary" />
                                Courses Format
                            </h3>
                            <ul className="space-y-3 text-sm text-muted-foreground">
                                <li className="flex gap-2.5">
                                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span><strong>Required:</strong> course_name, instructor, section, program, type, hours</span>
                                </li>
                                <li className="flex gap-2.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0 mt-2" />
                                    <span>Type must be "Lab" or "Theory"</span>
                                </li>
                            </ul>
                        </div>

                        <div className="h-px bg-border/50" />

                        <div>
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <School className="h-4 w-4 text-primary" />
                                Rooms Format
                            </h3>
                            <ul className="space-y-3 text-sm text-muted-foreground">
                                <li className="flex gap-2.5">
                                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span><strong>Required:</strong> rooms, type (Lab/Theory)</span>
                                </li>
                                <li className="flex gap-2.5">
                                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                    <span>Capacity defaults to 50 if missing</span>
                                </li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}