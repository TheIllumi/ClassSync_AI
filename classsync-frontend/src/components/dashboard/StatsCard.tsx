import { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatsCardProps {
    title: string
    value: string | number
    icon: LucideIcon
    description?: string
    trend?: {
        value: number
        isPositive: boolean
    }
    color?: 'blue' | 'purple' | 'green' | 'coral'
}

const colorClasses = {
    blue: 'bg-primary/10 text-primary',
    purple: 'bg-secondary/10 text-secondary',
    green: 'bg-accent/10 text-accent',
    coral: 'bg-destructive/10 text-destructive',
}

export function StatsCard({
                              title,
                              value,
                              icon: Icon,
                              description,
                              trend,
                              color = 'blue'
                          }: StatsCardProps) {
    return (
        <Card className="transition-all hover:shadow-lg hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <div className={cn("rounded-lg p-2", colorClasses[color])}>
                    <Icon className="h-4 w-4" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">{value}</div>
                {description && (
                    <p className="text-xs text-muted-foreground mt-1">
                        {description}
                    </p>
                )}
                {trend && (
                    <div className="flex items-center gap-1 mt-2">
            <span className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-accent" : "text-destructive"
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
                        <span className="text-xs text-muted-foreground">vs last month</span>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}