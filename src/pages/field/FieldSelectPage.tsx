import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Zap, MapPin, ChevronRight, Wifi, WifiOff, ClipboardList } from 'lucide-react'
import { usePublicAssets, usePlans } from '@/hooks/usePlans'
import { Spinner } from '@/components/ui/Spinner'
import type { PlanType } from '@/types'

export function FieldSelectPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'type' | 'asset' | 'plan'>('type')
  const [planType, setPlanType] = useState<PlanType>('preventiva')
  const [selectedAssetId, setSelectedAssetId] = useState<string>('')
  const [assetSearch, setAssetSearch] = useState('')
  const isOnline = navigator.onLine

  const { data: assets, isLoading: loadingAssets } = usePublicAssets()
  const { data: plans, isLoading: loadingPlans } = usePlans(
    step === 'plan' ? selectedAssetId : undefined,
    step === 'plan' ? planType : undefined
  )

  const filteredAssets = (assets ?? []).filter(a =>
    a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
    (a.location ?? '').toLowerCase().includes(assetSearch.toLowerCase())
  )

  function selectType(type: PlanType) {
    setPlanType(type)
    setStep('asset')
  }

  function selectAsset(assetId: string) {
    setSelectedAssetId(assetId)
    setStep('plan')
  }

  function selectPlan(planId: string) {
    navigate(`/field/form/${planId}?asset=${selectedAssetId}&type=${planType}`)
  }

  const assetTypeIcon: Record<string, string> = { equipment: '⚙️', location: '📍', building: '🏢' }

  return (
    <div className="min-h-screen bg-metro-bg">
      {/* Header */}
      <div className="bg-metro-navy px-4 pt-4 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-metro-orange rounded-full flex items-center justify-center text-white font-bold text-sm">M</div>
          <span className="text-white font-semibold">Metrô Manutenção</span>
          <div className="ml-auto">
            {isOnline
              ? <Wifi size={16} className="text-green-400" />
              : <WifiOff size={16} className="text-red-400" />
            }
          </div>
        </div>
        <p className="text-white/60 text-xs mt-2">
          {step === 'type' && 'Selecione o tipo de registro'}
          {step === 'asset' && 'Selecione o ativo'}
          {step === 'plan' && 'Selecione o plano'}
        </p>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 mt-2 text-xs text-white/50">
          <button
            onClick={() => setStep('type')}
            className={step === 'type' ? 'text-metro-orange font-semibold' : 'text-white/80'}
          >
            Tipo
          </button>
          <ChevronRight size={12} />
          <button
            onClick={() => step === 'plan' && setStep('asset')}
            className={step === 'asset' ? 'text-metro-orange font-semibold' : step === 'plan' ? 'text-white/80' : ''}
          >
            Ativo
          </button>
          <ChevronRight size={12} />
          <span className={step === 'plan' ? 'text-metro-orange font-semibold' : ''}>Plano</span>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">

        {/* Step: type selection */}
        {step === 'type' && (
          <div className="space-y-3 mt-2">
          <button
            onClick={() => navigate('/field/pending')}
            className="w-full bg-white border border-gray-200 text-metro-navy rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:border-metro-orange active:scale-[0.98] transition"
          >
            <div className="w-10 h-10 bg-metro-orange/10 rounded-xl flex items-center justify-center shrink-0">
              <ClipboardList size={20} className="text-metro-orange" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm">Ver OSs pendentes</p>
              <p className="text-xs text-gray-400">Acesse formulários já criados aguardando preenchimento</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>

          <p className="text-xs text-gray-400 text-center">ou crie um novo registro:</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => selectType('preventiva')}
              className="bg-metro-orange text-white rounded-2xl p-5 flex flex-col items-center gap-3 shadow active:scale-95 transition"
            >
              <Wrench size={32} strokeWidth={1.5} />
              <span className="font-semibold text-sm">Preventiva</span>
            </button>
            <button
              onClick={() => selectType('irq')}
              className="bg-metro-navy text-white rounded-2xl p-5 flex flex-col items-center gap-3 shadow active:scale-95 transition"
            >
              <Zap size={32} strokeWidth={1.5} />
              <span className="font-semibold text-sm">IRQ</span>
            </button>
          </div>
          </div>
        )}

        {/* Step: asset selection */}
        {step === 'asset' && (
          <div>
            <input
              type="search"
              placeholder="Buscar ativo ou localidade..."
              value={assetSearch}
              onChange={e => setAssetSearch(e.target.value)}
              className="w-full mb-3 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange bg-white"
            />
            {loadingAssets ? (
              <Spinner />
            ) : filteredAssets.length === 0 ? (
              <p className="text-center text-gray-400 text-sm mt-8">Nenhum ativo encontrado.</p>
            ) : (
              <div className="space-y-2">
                {filteredAssets.map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => selectAsset(asset.id)}
                    className="w-full bg-white rounded-xl p-3 flex items-center gap-3 border border-gray-100 shadow-sm hover:border-metro-orange transition text-left"
                  >
                    <span className="text-xl">{assetTypeIcon[asset.type] ?? '⚙️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-metro-navy text-sm truncate">{asset.name}</p>
                      {asset.location && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <MapPin size={10} /> {asset.location}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: plan selection */}
        {step === 'plan' && (
          <div>
            {loadingPlans ? (
              <Spinner />
            ) : (plans ?? []).length === 0 ? (
              <div className="text-center mt-8">
                <p className="text-gray-500 text-sm">
                  Nenhum plano de {planType === 'preventiva' ? 'preventiva' : 'IRQ'} disponível para este ativo.
                </p>
                <button onClick={() => setStep('asset')} className="mt-4 text-metro-orange text-sm font-medium">
                  ← Voltar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {(plans ?? []).map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => selectPlan(plan.id)}
                    className="w-full bg-white rounded-xl p-4 flex items-center gap-3 border border-gray-100 shadow-sm hover:border-metro-orange transition text-left"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-metro-navy text-sm">{plan.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Frequência: {plan.frequency}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
