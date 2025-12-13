import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function MainLayout() {
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />

            <div className="flex flex-1 flex-col overflow-hidden">
                <Header />

                <main className="flex-1 overflow-y-auto">
                    <div className="container mx-auto p-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}