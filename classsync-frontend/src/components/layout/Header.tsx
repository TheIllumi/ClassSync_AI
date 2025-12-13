import { Bell, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Header() {
    return (
        <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-sm">
            <div className="flex h-16 items-center gap-4 px-6">
                {/* Search */}
                <div className="flex flex-1 items-center gap-2">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search courses, teachers, rooms..."
                            className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="relative">
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive"></span>
                    </Button>
                </div>
            </div>
        </header>
    )
}