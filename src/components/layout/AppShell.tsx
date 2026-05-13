import type { ReactNode } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { useViewMode } from '@/hooks/useViewMode'

export function AppShell({ children }: { children: ReactNode }) {
  const { isDesktop } = useViewMode()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {isDesktop && <Sidebar />}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        {!isDesktop && <BottomNav />}
      </div>
    </div>
  )
}
