import { useEffect, useState } from 'react'

export type ViewMode = 'mobile' | 'desktop'

const STORAGE_KEY = 'metro_view_mode'

function getInitialMode(): ViewMode {
  const stored = localStorage.getItem(STORAGE_KEY) as ViewMode | null
  if (stored) return stored
  return 'desktop'
}

export function useViewMode() {
  const [mode, setMode] = useState<ViewMode>(getInitialMode)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const toggle = () => setMode(prev => prev === 'mobile' ? 'desktop' : 'mobile')

  return { mode, toggle, isDesktop: mode === 'desktop', isMobile: mode === 'mobile' }
}
