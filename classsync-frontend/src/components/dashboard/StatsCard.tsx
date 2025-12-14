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
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
    coral: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
}

const gradientClasses = {
    blue: 'from-blue-50/50 to-transparent dark:from-blue-900/10',
    purple: 'from-purple-50/50 to-transparent dark:from-purple-900/10',
    green: 'from-green-50/50 to-transparent dark:from-green-900/10',
    coral: 'from-red-50/50 to-transparent dark:from-red-900/10',
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
        <Card className={cn(
            "transition-all hover:shadow-lg hover:-translate-y-1 bg-gradient-to-br",
            gradientClasses[color]
        )}>
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
                trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
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