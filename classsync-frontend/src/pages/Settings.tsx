import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Plus, Trash2, Check, Sliders, Cpu, Settings2, Clock, AlertTriangle } from 'lucide-react'
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            {/* Page Header */}
            <div className="flex items-center gap-4 border-b border-border/40 pb-6">
                <div className="p-3 bg-primary/10 rounded-xl text-primary">
                    <Settings2 className="h-8 w-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        Configure constraint profiles and optimize algorithmic parameters
                    </p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-8 lg:grid-cols-12">
                {/* Left Column: Configuration List */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Sliders className="h-5 w-5 text-muted-foreground" />
                            Profiles
                        </h2>
                        <Button size="sm" variant="outline" onClick={() => alert('Create feature coming soon!')}>
                            <Plus className="h-4 w-4 mr-2" /> New
                        </Button>
                    </div>

                    <Card className="border-border/60 shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="p-8 text-center text-muted-foreground">Loading...</div>
                            ) : configs.length > 0 ? (
                                <div className="divide-y divide-border/50">
                                    {configs.map((config) => (
                                        <div
                                            key={config.id}
                                            className={cn(
                                                "p-4 cursor-pointer transition-all hover:bg-muted/50 flex flex-col gap-2 relative group",
                                                selectedConfig?.id === config.id ? "bg-muted/50" : ""
                                            )}
                                            onClick={() => setSelectedConfig(config)}
                                        >
                                            {config.is_default && (
                                                <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[10px] uppercase font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full tracking-wider">
                                                    Active
                                                </div>
                                            )}
                                            
                                            <div>
                                                <p className={cn("font-medium text-base", selectedConfig?.id === config.id ? "text-primary" : "text-foreground")}>
                                                    {config.name}
                                                </p>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {config.timeslot_duration_minutes}m
                                                    </span>
                                                    <span>•</span>
                                                    <span>{config.days_per_week} Days</span>
                                                </div>
                                            </div>

                                            {selectedConfig?.id === config.id && (
                                                <div className="flex items-center gap-2 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    {!config.is_default && (
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            className="h-7 text-xs w-full"
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
                                                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (confirm('Delete this configuration?')) deleteMutation.mutate(config.id)
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">No profiles found</div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Configuration Details & Optimizer */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Active/Selected Config Details */}
                    <Card className="border-border/60 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                        <CardHeader className="pb-4 border-b border-border/40 bg-muted/10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-xl">
                                        {selectedConfig ? selectedConfig.name : (defaultConfig ? defaultConfig.name : 'Configuration Details')}
                                    </CardTitle>
                                    <CardDescription>
                                        {selectedConfig ? 'Editing selected profile' : 'Currently viewing active profile'}
                                    </CardDescription>
                                </div>
                                {selectedConfig && (
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedConfig(null)}>
                                        <Check className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {(selectedConfig || defaultConfig) ? (
                                <div className="space-y-8">
                                    {/* Time Settings Section */}
                                    <div>
                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                                            <Clock className="h-4 w-4" /> Schedule Parameters
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="p-3 bg-background rounded-lg border border-border/60">
                                                <p className="text-xs text-muted-foreground mb-1">Days / Week</p>
                                                <p className="text-lg font-bold">{(selectedConfig || defaultConfig)?.days_per_week}</p>
                                            </div>
                                            <div className="p-3 bg-background rounded-lg border border-border/60">
                                                <p className="text-xs text-muted-foreground mb-1">Slot Duration</p>
                                                <p className="text-lg font-bold">{(selectedConfig || defaultConfig)?.timeslot_duration_minutes}m</p>
                                            </div>
                                            <div className="p-3 bg-background rounded-lg border border-border/60">
                                                <p className="text-xs text-muted-foreground mb-1">Start Time</p>
                                                <p className="text-lg font-bold">{(selectedConfig || defaultConfig)?.start_time}</p>
                                            </div>
                                            <div className="p-3 bg-background rounded-lg border border-border/60">
                                                <p className="text-xs text-muted-foreground mb-1">End Time</p>
                                                <p className="text-lg font-bold">{(selectedConfig || defaultConfig)?.end_time}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-8">
                                        {/* Hard Constraints */}
                                        <div>
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                                                <AlertTriangle className="h-4 w-4" /> Hard Constraints
                                            </h3>
                                            <div className="space-y-2">
                                                {(selectedConfig || defaultConfig)?.hard_constraints &&
                                                    Object.keys((selectedConfig || defaultConfig)!.hard_constraints!).map((key) => (
                                                        <div key={key} className="flex items-center gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-sm">
                                                            <Check className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                                                            <span className="text-red-900 dark:text-red-200 capitalize">{key.replace(/_/g, ' ')}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>

                                        {/* Soft Constraints */}
                                        <div>
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                                                <Sliders className="h-4 w-4" /> Preferences
                                            </h3>
                                            <div className="space-y-2">
                                                {(selectedConfig || defaultConfig)?.soft_constraints &&
                                                    Object.entries((selectedConfig || defaultConfig)!.soft_constraints!).map(([key, value]) => (
                                                        <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/60 text-sm">
                                                            <span className="text-foreground/80 capitalize">{key.replace(/_/g, ' ')}</span>
                                                            <span className="font-semibold bg-secondary/10 text-secondary px-2 py-0.5 rounded text-xs">
                                                                {typeof value === 'number' ? `Weight: ${value}` : 'Enabled'}
                                                            </span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {selectedConfig && (
                                        <div className="pt-4 border-t border-border/40 flex justify-end">
                                            <Button onClick={() => alert('Save feature coming soon!')}>
                                                <Save className="mr-2 h-4 w-4" /> Save Changes
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="py-12 text-center text-muted-foreground">Select a profile to view details</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Optimizer Settings */}
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader className="bg-muted/5 border-b border-border/40">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <Cpu className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Genetic Algorithm Engine</CardTitle>
                                    <CardDescription>Fine-tune the optimization parameters</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Population Size</label>
                                    <Input
                                        type="number"
                                        value={optimizerSettings.population_size}
                                        onChange={(e) => setOptimizerSettings(s => ({ ...s, population_size: toInt(e.target.value) }))}
                                    />
                                    <p className="text-[11px] text-muted-foreground">Higher = more diversity, slower.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Generations</label>
                                    <Input
                                        type="number"
                                        value={optimizerSettings.generations}
                                        onChange={(e) => setOptimizerSettings(s => ({ ...s, generations: toInt(e.target.value) }))}
                                    />
                                    <p className="text-[11px] text-muted-foreground">Iterations to evolve.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Mutation Rate (0-1)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={optimizerSettings.mutation_rate}
                                        onChange={(e) => setOptimizerSettings(s => ({ ...s, mutation_rate: toFloat(e.target.value) }))}
                                    />
                                    <p className="text-[11px] text-muted-foreground">Probability of random changes.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Elite Size</label>
                                    <Input
                                        type="number"
                                        value={optimizerSettings.elite_size}
                                        onChange={(e) => setOptimizerSettings(s => ({ ...s, elite_size: toInt(e.target.value) }))}
                                    />
                                    <p className="text-[11px] text-muted-foreground">Best schedules kept per generation.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Max Time (s)</label>
                                    <Input
                                        type="number"
                                        value={optimizerSettings.max_time}
                                        onChange={(e) => setOptimizerSettings(s => ({ ...s, max_time: toInt(e.target.value) }))}
                                    />
                                    <p className="text-[11px] text-muted-foreground">Hard time limit.</p>
                                </div>
                                <div className="flex items-end">
                                    <Button className="w-full" onClick={() => alert('Settings saved locally for next run.')}>
                                        <Save className="mr-2 h-4 w-4" /> Save Parameters
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
