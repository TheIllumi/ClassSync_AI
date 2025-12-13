import { Link, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Upload,
    Calendar,
    Settings,
    // FileSpreadsheet
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Upload Datasets', href: '/upload', icon: Upload },
    { name: 'Timetables', href: '/timetables', icon: Calendar },
    // { name: 'Export', href: '/export', icon: FileSpreadsheet },
    { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
    const location = useLocation()

    return (
        <div className="flex h-screen w-64 flex-col bg-gradient-to-b from-primary/10 to-secondary/10 border-r">
            {/* Logo */}
            <div className="flex h-16 items-center gap-2 px-6 border-b">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white font-bold text-xl">
                    CS
                </div>
                <div>
                    <h1 className="font-bold text-lg">ClassSync AI</h1>
                    <p className="text-xs text-muted-foreground">Smart Scheduling</p>
                </div>
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
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                                isActive
                                    ? "bg-primary text-white shadow-md"
                                    : "text-foreground hover:bg-white/50 hover:shadow-sm"
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="border-t p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/30 text-sm font-semibold">
                        SM
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Saad Mughal</p>
                        <p className="text-xs text-muted-foreground truncate">Admin</p>
                    </div>
                </div>
            </div>
        </div>
    )
}