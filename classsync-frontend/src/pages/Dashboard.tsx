import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Upload, Clock, CheckCircle, PieChart, AlertCircle, ArrowRight, Plus } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { timetablesApi, dashboardApi, healthApi } from '@/lib/api'
import { formatDateTime, formatDate } from '@/lib/utils'

export function Dashboard() {
    const navigate = useNavigate()

    // Fetch dashboard stats (Optimized)
    const { data: stats } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: () => dashboardApi.stats().then(res => res.data),
    })

    // Fetch recent timetables (for list)
    const { data: timetables } = useQuery({
        queryKey: ['timetables'],
        queryFn: () => timetablesApi.list().then(res => res.data),
    })

    // Fetch System Health
    const { data: health, isLoading: isHealthLoading } = useQuery({
        queryKey: ['health'],
        queryFn: () => healthApi.check().then(res => res.data),
        refetchInterval: 30000,
    })

    const isApiOperational = health?.components?.api === 'operational'
    const isDbOperational = health?.components?.database === 'operational'

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good morning'
        if (hour < 18) return 'Good afternoon'
        return 'Good evening'
    }

    const totalStatus = stats?.total_timetables || 1

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/20 via-primary/5 to-background/50 border border-primary/10 p-8 shadow-lg backdrop-blur-sm">
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                        <h1 className="text-4xl font-bold tracking-tight text-foreground">
                            {getGreeting()}, Admin
                        </h1>
                        <p className="text-muted-foreground text-lg leading-relaxed">
                            It's {formatDate(new Date())}. Your scheduling engine is ready for optimization. 
                            Review your datasets below or start a new generation cycle.
                        </p>
                    </div>
                    <Button 
                        size="lg" 
                        className="shadow-xl hover:shadow-2xl hover:scale-105 transition-all bg-primary text-primary-foreground border-none h-12 px-8 text-base"
                        onClick={() => navigate('/timetables')} 
                    >
                        <Plus className="mr-2 h-5 w-5" />
                        Generate New Schedule
                    </Button>
                </div>
                {/* Decorative background element */}
                <div className="absolute -right-10 -top-10 h-96 w-96 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-3xl opacity-50 pointer-events-none" />
                <div className="absolute -left-10 -bottom-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl opacity-50 pointer-events-none" />
            </div>

            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Total Timetables"
                    value={stats?.total_timetables || 0}
                    icon={Calendar}
                    description="Generated schedules"
                    color="blue"
                />
                <StatsCard
                    title="Uploaded Datasets"
                    value={stats?.total_datasets || 0}
                    icon={Upload}
                    description="Courses and rooms"
                    color="purple"
                />
                <StatsCard
                    title="Active Schedules"
                    value={stats?.active_schedules || 0}
                    icon={CheckCircle}
                    description="Completed timetables"
                    color="green"
                />
                <StatsCard
                    title="Avg Generation Time"
                    value={`${stats?.avg_generation_time || 0}s`}
                    icon={Clock}
                    description="Per timetable"
                    color="coral"
                />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Recent Timetables - Spans 4 columns */}
                <Card className="lg:col-span-4">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Recent Activity</CardTitle>
                            <CardDescription>Latest generated timetables</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate('/timetables')}>
                            View All <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {timetables && timetables.length > 0 ? (
                            <div className="space-y-4">
                                {timetables.slice(0, 5).map((timetable: any) => (
                                    <div
                                        key={timetable.id}
                                        className="group flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-accent/5 hover:border-accent/20 transition-all cursor-pointer"
                                        onClick={() => navigate(`/timetables/${timetable.id}`)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-full ${
                                                timetable.status === 'COMPLETED' ? 'bg-green-100 text-green-600 dark:bg-green-900/20' :
                                                timetable.status === 'FAILED' ? 'bg-red-100 text-red-600 dark:bg-red-900/20' :
                                                'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20'
                                            }`}>
                                                {timetable.status === 'COMPLETED' ? <CheckCircle className="h-5 w-5" /> :
                                                 timetable.status === 'FAILED' ? <AlertCircle className="h-5 w-5" /> :
                                                 <Clock className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm">{timetable.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDateTime(timetable.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right hidden sm:block">
                                                <p className="text-xs font-medium text-foreground">
                                                    {timetable.semester} {timetable.year}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {timetable.conflict_count || 0} conflicts
                                                </p>
                                            </div>
                                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl border-muted">
                                <div className="bg-muted/50 p-4 rounded-full mb-4">
                                    <Calendar className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h3 className="font-semibold text-lg">No timetables yet</h3>
                                <p className="text-muted-foreground text-sm max-w-xs mt-1 mb-6">
                                    Start by creating your first schedule optimized by AI.
                                </p>
                                <Button onClick={() => navigate('/timetables')}>Generate First Timetable</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="lg:col-span-3 space-y-6">
                    {/* Status Distribution */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PieChart className="h-5 w-5 text-muted-foreground" />
                                Status Overview
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {stats ? (
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Completed</span>
                                            <span className="font-medium">{stats.status_distribution.completed}</span>
                                        </div>
                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-green-500 rounded-full" 
                                                style={{ width: `${(stats.status_distribution.completed / totalStatus) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Pending</span>
                                            <span className="font-medium">{stats.status_distribution.pending}</span>
                                        </div>
                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-yellow-500 rounded-full" 
                                                style={{ width: `${(stats.status_distribution.pending / totalStatus) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Failed</span>
                                            <span className="font-medium">{stats.status_distribution.failed}</span>
                                        </div>
                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-red-500 rounded-full" 
                                                style={{ width: `${(stats.status_distribution.failed / totalStatus) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">Loading stats...</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* System Health */}
                    <Card>
                        <CardHeader>
                            <CardTitle>System Health</CardTitle>
                            <CardDescription>Infrastructure Status</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {/* Optimizer Status */}
                                <div className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex h-3 w-3">
                                            {isApiOperational && (
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            )}
                                            <span className={`relative inline-flex rounded-full h-3 w-3 ${isApiOperational ? 'bg-green-500' : 'bg-destructive'}`}></span>
                                        </div>
                                        <span className="font-medium text-sm">Optimizer Engine</span>
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${isApiOperational ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' : 'text-destructive bg-destructive/10'}`}>
                                        {isHealthLoading ? 'Checking...' : (isApiOperational ? 'Operational' : 'Offline')}
                                    </span>
                                </div>

                                {/* Database Status */}
                                <div className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-3 w-3 rounded-full ${isDbOperational ? 'bg-green-500' : 'bg-destructive'}`}></div>
                                        <span className="font-medium text-sm">Database</span>
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${isDbOperational ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' : 'text-destructive bg-destructive/10'}`}>
                                        {isHealthLoading ? 'Checking...' : (isDbOperational ? 'Connected' : 'Error')}
                                    </span>
                                </div>

                                {/* Data Readiness */}
                                <div className="pt-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium">Data Readiness</h4>
                                        <span className={stats && stats.total_datasets > 0 ? "text-xs text-green-600 dark:text-green-400 font-medium" : "text-xs text-amber-600 dark:text-amber-400 font-medium"}>
                                            {stats && stats.total_datasets > 0 ? 'Ready' : 'Incomplete'}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-1000 ease-out ${stats && stats.total_datasets > 0 ? 'bg-primary w-full' : 'bg-amber-400 w-[5%]'}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}