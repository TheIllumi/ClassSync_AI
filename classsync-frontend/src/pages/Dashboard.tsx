import { useQuery } from '@tanstack/react-query'
import { Calendar, Upload, Clock, CheckCircle } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { timetablesApi, datasetsApi } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

export function Dashboard() {
    // Fetch timetables
    const { data: timetables } = useQuery({
        queryKey: ['timetables'],
        queryFn: () => timetablesApi.list().then(res => res.data),
    })

    // Fetch datasets
    const { data: datasets } = useQuery({
        queryKey: ['datasets'],
        queryFn: () => datasetsApi.list().then(res => res.data),
    })

    const stats = {
        totalTimetables: timetables?.length || 0,
        totalDatasets: datasets?.length || 0,
        activeSchedules: timetables?.filter((t: any) => t.status === 'COMPLETED').length || 0,
        lastGenerated: timetables?.[0]?.created_at,
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                    Welcome back! Here's an overview of your timetabling system.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Total Timetables"
                    value={stats.totalTimetables}
                    icon={Calendar}
                    description="Generated schedules"
                    color="blue"
                />
                <StatsCard
                    title="Uploaded Datasets"
                    value={stats.totalDatasets}
                    icon={Upload}
                    description="Courses and rooms"
                    color="purple"
                />
                <StatsCard
                    title="Active Schedules"
                    value={stats.activeSchedules}
                    icon={CheckCircle}
                    description="Completed timetables"
                    color="green"
                />
                <StatsCard
                    title="Avg Generation Time"
                    value="2.5 min"
                    icon={Clock}
                    description="Per timetable"
                    color="coral"
                />
            </div>

            {/* Recent Activity */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Recent Timetables */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Timetables</CardTitle>
                        <CardDescription>Latest generated schedules</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {timetables && timetables.length > 0 ? (
                            <div className="space-y-3">
                                {timetables.slice(0, 5).map((timetable: any) => (
                                    <div
                                        key={timetable.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                                    >
                                        <div>
                                            <p className="font-medium">{timetable.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDateTime(timetable.created_at)}
                                            </p>
                                        </div>
                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                            timetable.status === 'COMPLETED'
                                                ? 'bg-accent/20 text-accent'
                                                : 'bg-muted text-muted-foreground'
                                        }`}>
                      {timetable.status}
                    </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>No timetables yet</p>
                                <Button className="mt-4" size="sm">Generate First Timetable</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>Common tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Button className="w-full justify-start" variant="outline">
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Dataset
                        </Button>
                        <Button className="w-full justify-start" variant="outline">
                            <Calendar className="mr-2 h-4 w-4" />
                            Generate Timetable
                        </Button>
                        <Button className="w-full justify-start" variant="outline">
                            <CheckCircle className="mr-2 h-4 w-4" />
                            View All Timetables
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}