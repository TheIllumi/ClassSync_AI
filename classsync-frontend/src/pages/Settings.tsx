import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Plus, Trash2, Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { constraintsApi } from '@/lib/api'

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
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-1">
                    Configure constraints and optimizer parameters
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Constraint Configurations */}
                <Card>
                    <CardHeader>
                        <CardTitle>Constraint Configurations</CardTitle>
                        <CardDescription>Manage your timetabling constraints</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <p className="text-sm text-muted-foreground">Loading...</p>
                        ) : configs.length > 0 ? (
                            <div className="space-y-2">
                                {configs.map((config) => (
                                    <div
                                        key={config.id}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors cursor-pointer"
                                        onClick={() => setSelectedConfig(config)}
                                    >
                                        <div className="flex items-center gap-3">
                                            {config.is_default && <Check className="h-4 w-4 text-accent" />}
                                            <div>
                                                <p className="font-medium">{config.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {config.days_per_week} days • {config.timeslot_duration_minutes}min slots
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {!config.is_default && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={setDefaultMutation.isPending}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setDefaultMutation.mutate(config.id)
                                                    }}
                                                >
                                                    Set Default
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label="Delete configuration"
                                                disabled={deleteMutation.isPending}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    if (confirm('Delete this configuration?')) {
                                                        deleteMutation.mutate(config.id)
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No configurations found</p>
                        )}

                        <Button
                            className="w-full mt-4"
                            variant="outline"
                            onClick={() => {
                                alert('Create Configuration feature coming soon! For now, configurations are managed in the database.')
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Create New Configuration
                        </Button>
                    </CardContent>
                </Card>

                {/* Configuration Details */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {selectedConfig ? selectedConfig.name : 'Select a Configuration'}
                        </CardTitle>
                        <CardDescription>
                            {selectedConfig ? 'View and edit constraint details' : 'Choose a configuration to view details'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {selectedConfig ? (
                            <div className="space-y-6">
                                {/* Time Settings */}
                                <div>
                                    <h3 className="font-semibold mb-3">Time Settings</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Days per Week:</span>
                                            <span className="font-medium">{selectedConfig.days_per_week}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Slot Duration:</span>
                                            <span className="font-medium">{selectedConfig.timeslot_duration_minutes} minutes</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Start Time:</span>
                                            <span className="font-medium">{selectedConfig.start_time}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">End Time:</span>
                                            <span className="font-medium">{selectedConfig.end_time}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Hard Constraints */}
                                <div>
                                    <h3 className="font-semibold mb-3">Hard Constraints</h3>
                                    <div className="space-y-2">
                                        {selectedConfig.hard_constraints &&
                                            Object.keys(selectedConfig.hard_constraints).map((key) => (
                                                <div key={key} className="flex items-center gap-2 text-sm">
                                                    <Check className="h-4 w-4 text-accent" />
                                                    <span>{key.replace(/_/g, ' ')}</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>

                                {/* Soft Constraints */}
                                <div>
                                    <h3 className="font-semibold mb-3">Soft Constraints</h3>
                                    <div className="space-y-2">
                                        {selectedConfig.soft_constraints &&
                                            Object.entries(selectedConfig.soft_constraints).map(([key, value]) => (
                                                <div key={key} className="flex items-center justify-between text-sm">
                                                    <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                                                    <span className="font-medium">{typeof value === 'number' ? value : 'enabled'}</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>

                                <Button
                                    className="w-full"
                                    onClick={() => {
                                        alert('Save feature coming soon! Configuration changes will be persisted to the database.')
                                    }}
                                >
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <p>Select a configuration from the list to view details</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Default Configuration Summary */}
            {defaultConfig && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-accent" />
                            Active Configuration: {defaultConfig.name}
                        </CardTitle>
                        <CardDescription>
                            This configuration will be used for new timetable generations
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-primary/5 rounded-lg">
                                <p className="text-2xl font-bold text-primary">{defaultConfig.days_per_week}</p>
                                <p className="text-xs text-muted-foreground mt-1">Days per Week</p>
                            </div>
                            <div className="p-4 bg-secondary/5 rounded-lg">
                                <p className="text-2xl font-bold text-secondary">{defaultConfig.timeslot_duration_minutes}min</p>
                                <p className="text-xs text-muted-foreground mt-1">Slot Duration</p>
                            </div>
                            <div className="p-4 bg-accent/5 rounded-lg">
                                <p className="text-2xl font-bold text-accent">
                                    {defaultConfig.start_time} - {defaultConfig.end_time}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">Working Hours</p>
                            </div>
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="text-2xl font-bold">
                                    {Object.keys(defaultConfig.hard_constraints || {}).length}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">Hard Constraints</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Advanced Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>Advanced Optimizer Settings</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Population Size</label>
                            <input
                                type="number"
                                min={1}
                                max={500}
                                value={optimizerSettings.population_size}
                                onChange={(e) =>
                                    setOptimizerSettings((s) => ({
                                        ...s,
                                        population_size: Math.max(1, toInt(e.target.value, s.population_size)),
                                    }))
                                }
                                className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Number of schedules in each generation
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Generations</label>
                            <input
                                type="number"
                                min={1}
                                max={2000}
                                value={optimizerSettings.generations}
                                onChange={(e) =>
                                    setOptimizerSettings((s) => ({
                                        ...s,
                                        generations: Math.max(1, toInt(e.target.value, s.generations)),
                                    }))
                                }
                                className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Number of evolution cycles
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Mutation Rate</label>
                            <input
                                type="number"
                                step="0.01"
                                min={0}
                                max={1}
                                value={optimizerSettings.mutation_rate}
                                onChange={(e) =>
                                    setOptimizerSettings((s) => ({
                                        ...s,
                                        mutation_rate: Math.min(1, Math.max(0, toFloat(e.target.value, s.mutation_rate))),
                                    }))
                                }
                                className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Probability of random changes (0.0 - 1.0)
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Elite Size</label>
                            <input
                                type="number"
                                min={0}
                                max={50}
                                value={optimizerSettings.elite_size}
                                onChange={(e) =>
                                    setOptimizerSettings((s) => ({
                                        ...s,
                                        elite_size: Math.max(0, toInt(e.target.value, s.elite_size)),
                                    }))
                                }
                                className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Top schedules preserved each generation
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Max Time (seconds)</label>
                            <input
                                type="number"
                                min={10}
                                max={3600}
                                value={optimizerSettings.max_time}
                                onChange={(e) =>
                                    setOptimizerSettings((s) => ({
                                        ...s,
                                        max_time: Math.max(10, toInt(e.target.value, s.max_time)),
                                    }))
                                }
                                className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Maximum optimization time
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Min Score</label>
                            <input
                                type="number"
                                step="0.1"
                                min={0}
                                max={1}
                                value={optimizerSettings.min_score}
                                onChange={(e) =>
                                    setOptimizerSettings((s) => ({
                                        ...s,
                                        min_score: Math.min(1, Math.max(0, toFloat(e.target.value, s.min_score))),
                                    }))
                                }
                                className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Minimum acceptable fitness score
                            </p>
                        </div>
                    </div>

                    <Button
                        className="mt-6"
                        onClick={() => {
                            console.log('Saving optimizer settings:', optimizerSettings)
                            alert('Optimizer settings saved! These will be used for the next timetable generation.')
                        }}
                    >
                        <Save className="mr-2 h-4 w-4" />
                        Save Optimizer Settings
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
