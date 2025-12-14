import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Upload,
    Calendar,
    Settings,
    PanelLeft,
    // FileSpreadsheet
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Upload Datasets', href: '/upload', icon: Upload },
    { name: 'Timetables', href: '/timetables', icon: Calendar },
    // { name: 'Export', href: '/export', icon: FileSpreadsheet },
    { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
    const location = useLocation()
    const [isCollapsed, setIsCollapsed] = useState(false)

    return (
        <div
            className={cn(
                "flex h-screen flex-col bg-gradient-to-b from-primary/10 to-secondary/10 border-r transition-all duration-300 ease-in-out",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            {/* Logo */}
            <div className={cn(
                "flex h-16 items-center border-b px-4",
                isCollapsed ? "justify-center" : "justify-between"
            )}>
                <div
                    className={cn(
                        "overflow-hidden transition-all duration-300",
                        isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
                    )}
                >
                    <h1 className="font-bold text-lg whitespace-nowrap">ClassSync AI</h1>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <PanelLeft className="h-4 w-4" />
                </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navigation.map((item) => {
                    const isActive = location.pathname === item.href
                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all group",
                                isActive
                                    ? "bg-primary text-white shadow-md"
                                    : "text-foreground hover:bg-white/50 hover:shadow-sm",
                                isCollapsed && "justify-center px-2"
                            )}
                            title={isCollapsed ? item.name : undefined}
                        >
                            <item.icon className="h-5 w-5 shrink-0" />
                            <span
                                className={cn(
                                    "transition-all duration-300 whitespace-nowrap overflow-hidden",
                                    isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
                                )}
                            >
                                {item.name}
                            </span>
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="border-t p-4">
                <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/30 text-sm font-semibold">
                        SM
                    </div>
                    <div
                        className={cn(
                            "flex-1 min-w-0 transition-all duration-300",
                            isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
                        )}
                    >
                        <p className="text-sm font-medium truncate">Saad Mughal</p>
                        <p className="text-xs text-muted-foreground truncate">Admin</p>
                    </div>
                </div>
            </div>
        </div>
    )
}