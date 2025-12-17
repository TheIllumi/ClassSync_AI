import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Plus, Trash2, Check, Sliders, Cpu, Settings2, Clock, AlertTriangle, Calendar, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { constraintsApi } from '@/lib/api'
import { cn } from '@/lib/utils'

type ConstraintConfig = {
    id: number
    name: string
    is_default: boolean
    days_per_week: number
    timeslot_duration_minutes: number
    start_time: string
    end_time: string
    hard_constraints?: Record<string, unknown>
    soft_constraints?: Record<string, number | boolean>
}

export function Settings() {
    const queryClient = useQueryClient()

    const [selectedConfig, setSelectedConfig] = useState<ConstraintConfig | null>(null)

    const [optimizerSettings, setOptimizerSettings] = useState({
        population_size: 30,
        generations: 100,
        mutation_rate: 0.15,
        elite_size: 3,
        max_time: 300,
        min_score: 0.7,
    })

    // Fetch constraint configs
    const { data: configs = [], isLoading } = useQuery<ConstraintConfig[]>({
        queryKey: ['constraints'],
        queryFn: () => constraintsApi.list().then(res => res.data),
    })

    // Set default mutation
    const setDefaultMutation = useMutation({
        mutationFn: (id: number) => constraintsApi.setDefault(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['constraints'] })
        },
    })

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id: number) => constraintsApi.delete(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['constraints'] })
            setSelectedConfig(null)
        },
    })

    const defaultConfig = configs.find(c => c.is_default)
    const activeConfig = selectedConfig || defaultConfig

    // Helpers for numeric inputs with guards
    const toInt = (v: string, fallback = 0) => {
        const n = parseInt(v, 10)
        return Number.isFinite(n) ? n : fallback
    }
    const toFloat = (v: string, fallback = 0) => {
        const n = parseFloat(v)
        return Number.isFinite(n) ? n : fallback
    }

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-2">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground mt-1">
                        Configure scheduling constraints and algorithm parameters.
                    </p>
                </div>
                <Button size="sm" onClick={() => alert('Create feature coming soon!')}>
                    <Plus className="mr-2 h-4 w-4" /> New Profile
                </Button>
            </div>

            {/* Main Content Grid */}
            <div className="flex-1 min-h-0 grid gap-6 lg:grid-cols-12">
                
                {/* Left: Profiles List */}
                <div className="lg:col-span-4 flex flex-col min-h-0">
                    <Card className="flex-1 flex flex-col overflow-hidden border-border/60 shadow-sm bg-card/50">
                        <CardHeader className="py-4 px-6 border-b bg-muted/10 shrink-0">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Sliders className="h-4 w-4 text-muted-foreground" />
                                Constraint Profiles
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
                            ) : configs.length > 0 ? (
                                <div className="divide-y divide-border/50">
                                    {configs.map((config) => (
                                        <div
                                            key={config.id}
                                            className={cn(
                                                "group flex flex-col gap-2 p-4 cursor-pointer transition-all hover:bg-muted/30 border-l-2",
                                                activeConfig?.id === config.id 
                                                    ? "bg-muted/20 border-l-primary" 
                                                    : "border-l-transparent"
                                            )}
                                            onClick={() => setSelectedConfig(config)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className={cn(
                                                    "font-medium text-sm", 
                                                    activeConfig?.id === config.id ? "text-primary" : "text-foreground"
                                                )}>
                                                    {config.name}
                                                </span>
                                                {config.is_default && (
                                                    <span className="text-[10px] uppercase font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" /> {config.timeslot_duration_minutes}m
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" /> {config.days_per_week} days
                                                </span>
                                            </div>

                                            {/* Hover Actions */}
                                            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!config.is_default && (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="h-6 text-[10px] w-full"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setDefaultMutation.mutate(config.id)
                                                        }}
                                                        disabled={setDefaultMutation.isPending}
                                                    >
                                                        Set Active
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        if (confirm('Delete this configuration?')) deleteMutation.mutate(config.id)
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground text-sm">No profiles found</div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Details & Optimizer */}
                <div className="lg:col-span-8 flex flex-col gap-6 min-h-0 overflow-y-auto pr-1">
                    
                    {/* Profile Details */}
                    {activeConfig ? (
                        <Card className="border-border/60 shadow-sm shrink-0">
                            <CardHeader className="py-4 px-6 border-b bg-muted/10 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold">{activeConfig.name}</CardTitle>
                                    <CardDescription className="text-xs mt-0.5">
                                        {activeConfig.is_default ? 'System Default Profile' : 'Custom Configuration'}
                                    </CardDescription>
                                </div>
                                {!activeConfig.is_default && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs">
                                        Edit Details
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                {/* Time Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                                        <p className="text-xs text-muted-foreground mb-1">Schedule Days</p>
                                        <p className="text-lg font-bold">{activeConfig.days_per_week}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                                        <p className="text-xs text-muted-foreground mb-1">Slot Duration</p>
                                        <p className="text-lg font-bold">{activeConfig.timeslot_duration_minutes}m</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                                        <p className="text-xs text-muted-foreground mb-1">Start Time</p>
                                        <p className="text-lg font-bold">{activeConfig.start_time}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                                        <p className="text-xs text-muted-foreground mb-1">End Time</p>
                                        <p className="text-lg font-bold">{activeConfig.end_time}</p>
                                    </div>
                                </div>

                                {/* Constraints Grid */}
                                <div className="grid md:grid-cols-2 gap-6 pt-2">
                                    {/* Hard Constraints */}
                                    <div>
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                            <AlertTriangle className="h-3 w-3" /> Hard Rules
                                        </h4>
                                        <div className="space-y-2">
                                            {activeConfig.hard_constraints && Object.keys(activeConfig.hard_constraints).map((key) => (
                                                <div key={key} className="flex items-center gap-2 text-sm p-2 rounded bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                                                    <Check className="h-3 w-3 text-red-600 dark:text-red-400" />
                                                    <span className="text-red-900 dark:text-red-200 capitalize text-xs font-medium">
                                                        {key.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Soft Constraints */}
                                    <div>
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                            <Sliders className="h-3 w-3" /> Preferences
                                        </h4>
                                        <div className="space-y-2">
                                            {activeConfig.soft_constraints && Object.entries(activeConfig.soft_constraints).map(([key, value]) => (
                                                <div key={key} className="flex items-center justify-between p-2 rounded bg-background border border-border/60 text-sm">
                                                    <span className="text-muted-foreground capitalize text-xs">
                                                        {key.replace(/_/g, ' ')}
                                                    </span>
                                                    <span className="text-xs font-semibold bg-secondary/10 text-secondary px-1.5 py-0.5 rounded">
                                                        {typeof value === 'number' ? `w:${value}` : 'On'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="h-40 flex items-center justify-center border-2 border-dashed rounded-xl text-muted-foreground">
                            Select a profile to view details
                        </div>
                    )}

                    {/* Optimizer Settings */}
                    <Card className="border-border/60 shadow-sm shrink-0">
                        <CardHeader className="py-4 px-6 border-b bg-muted/10">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Cpu className="h-4 w-4 text-muted-foreground" />
                                Algorithm Engine Parameters
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium">Population Size</label>
                                    <Input
                                        type="number"
                                        className="h-8 text-sm"
                                        value={optimizerSettings.population_size}
                                        onChange={(e) => setOptimizerSettings(s => ({ ...s, population_size: toInt(e.target.value) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium">Generations</label>
                                    <Input
                                        type="number"
                                        className="h-8 text-sm"
                                        value={optimizerSettings.generations}
                                        onChange={(e) => setOptimizerSettings(s => ({ ...s, generations: toInt(e.target.value) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium">Mutation Rate</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        className="h-8 text-sm"
                                        value={optimizerSettings.mutation_rate}
                                        onChange={(e) => setOptimizerSettings(s => ({ ...s, mutation_rate: toFloat(e.target.value) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium">Elite Size</label>
                                    <Input
                                        type="number"
                                        className="h-8 text-sm"
                                        value={optimizerSettings.elite_size}
                                        onChange={(e) => setOptimizerSettings(s => ({ ...s, elite_size: toInt(e.target.value) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium">Max Time (s)</label>
                                    <Input
                                        type="number"
                                        className="h-8 text-sm"
                                        value={optimizerSettings.max_time}
                                        onChange={(e) => setOptimizerSettings(s => ({ ...s, max_time: toInt(e.target.value) }))}
                                    />
                                </div>
                                <div className="flex items-end">
                                    <Button size="sm" className="w-full h-8" onClick={() => alert('Settings saved locally.')}>
                                        <Save className="mr-2 h-3 w-3" /> Save Config
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}