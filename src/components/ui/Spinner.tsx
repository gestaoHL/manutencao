import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center justify-center py-12', className)}>
      <Loader2 size={32} className="animate-spin text-metro-orange" />
    </div>
  )
}
