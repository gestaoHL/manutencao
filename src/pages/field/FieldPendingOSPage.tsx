import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Calendar, MapPin, ClipboardList, ChevronLeft, Wifi, WifiOff, Search } from 'lucide-react'
import { usePublicPendingExecutions } from '@/hooks/useExecutions'
import { Spinner } from '@/components/ui/Spinner'

export function FieldPendingOSPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const isOnline = navigator.onLine

  const { data: executions, isLoading } = usePublicPendingExecutions()

  const filtered = (executions ?? []).filter(ex => {
    const q = search.toLowerCase()
    return (
      (ex.os_number ?? '').toLowerCase().includes(q) ||
      (ex.plan?.title ?? '').toLowerCase().includes(q) ||
      (ex.equipment?.name ?? '').toLowerCase().includes(q) ||
      (ex.locality?.name ?? '').toLowerCase().includes(q)
    )
  })

  function openForm(ex: typeof filtered[0]) {
    if (ex.plan?.form_url) {
      const base = ex.plan.form_url.startsWith('/')
        ? window.location.origin + ex.plan.form_url
        : ex.plan.form_url
      window.open(`${base}?id=${ex.id}`, '_blank', 'noopener,noreferrer')
    } else {
      navigate(`/field/form/${ex.plan_id}?executionId=${ex.id}&type=${ex.plan_type}`)
    }
  }

  return (
    <div className="min-h-screen bg-metro-bg">
      {/* Header */}
      <div className="bg-metro-navy px-4 pt-4 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/field/select')} className="text-white/70 hover:text-white">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-metro-orange rounded-full flex items-center justify-center text-white font-bold text-xs">M</div>
              <span className="text-white font-semibold text-sm">Ordens de Serviço Pendentes</span>
            </div>
            <p className="text-white/50 text-xs mt-0.5">Selecione uma OS para preencher o formulário</p>
          </div>
          {isOnline
            ? <Wifi size={16} className="text-green-400" />
            : <WifiOff size={16} className="text-red-400" />
          }
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="search"
            placeholder="Buscar por OS, plano, equipamento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/10 text-white text-sm placeholder:text-white/40 focus:outline-none focus:bg-white/20 transition"
          />
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {isLoading ? (
          <div className="flex justify-center mt-12">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center mt-12">
            <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm font-medium">
              {search ? 'Nenhuma OS encontrada para esta busca.' : 'Nenhuma OS pendente no momento.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ex => (
              <button
                key={ex.id}
                onClick={() => openForm(ex)}
                className="w-full bg-white rounded-2xl p-4 flex flex-col gap-2 border border-gray-100 shadow-sm hover:border-metro-orange active:scale-[0.98] transition text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-metro-navy text-sm truncate">{ex.plan?.title}</p>
                    {ex.equipment && (
                      <p className="text-xs text-gray-500 truncate">{ex.equipment.name}{ex.equipment.tag ? ` · ${ex.equipment.tag}` : ''}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-bold text-metro-orange bg-metro-orange/10 px-2 py-0.5 rounded-full">
                    {ex.plan_type === 'preventiva' ? 'Preventiva' : 'IRQ'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {ex.os_number && (
                    <span className="text-xs text-gray-500 font-mono">OS: {ex.os_number}</span>
                  )}
                  {ex.psa_item && (
                    <span className="text-xs text-gray-500">PSA: {ex.psa_item}</span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400">
                  {ex.scheduled_date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(ex.scheduled_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  {ex.locality?.name && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11} />
                      {ex.locality.name}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1 pt-1 border-t border-gray-50 text-metro-orange text-xs font-semibold">
                  <ExternalLink size={12} />
                  {ex.plan?.form_url ? 'Abrir formulário' : 'Preencher checklist'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
