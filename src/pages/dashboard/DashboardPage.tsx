import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import { TrendingUp, Wrench, Zap, CheckSquare } from 'lucide-react'
import { useKPIs, useMonthlyChart, useRecentActivity } from '@/hooks/useDashboard'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useNavigate } from 'react-router-dom'

function KPICard({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: React.ElementType; color: string
}) {
  return (
    <div className={`${color} rounded-2xl p-5 text-white shadow-sm`}>
      <Icon size={20} strokeWidth={1.8} className="opacity-70 mb-3" />
      <p className="text-3xl font-bold leading-none">{value}</p>
      <p className="text-xs font-medium opacity-70 mt-1.5 leading-tight">{label}</p>
    </div>
  )
}

export function DashboardPage() {
  const { data: kpis, isLoading: loadingKPIs } = useKPIs()
  const { data: monthly, isLoading: loadingChart } = useMonthlyChart()
  const { data: recent, isLoading: loadingRecent } = useRecentActivity()
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-metro-navy">Dashboard</h1>
        <p className="text-sm text-gray-400">Visão geral das manutenções</p>
      </div>

      {/* KPIs — 4 colunas no desktop */}
      {loadingKPIs ? <Spinner /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Total de OS"           value={kpis?.totalOS ?? 0}               icon={TrendingUp}  color="bg-metro-navy"   />
          <KPICard label="Preventivas Aprovadas" value={kpis?.preventivasDone ?? 0}       icon={Wrench}      color="bg-metro-orange" />
          <KPICard label="IRQs Pendentes"        value={kpis?.irqPending ?? 0}            icon={Zap}         color="bg-blue-600"     />
          <KPICard label="Taxa de Conformidade"  value={`${kpis?.conformanceRate ?? 0}%`} icon={CheckSquare} color="bg-green-600"    />
        </div>
      )}

      {/* Gráfico + Atividade lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-metro-navy uppercase tracking-wide mb-4">
            Últimos 6 Meses — Registros por Tipo
          </p>
          {loadingChart ? <Spinner /> : !monthly || monthly.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Sem dados para o período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthly} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e5e7eb' }}
                  labelStyle={{ fontWeight: 700, color: '#1A2B4A' }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="preventiva" name="Preventiva" fill="#E8571A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="irq"        name="IRQ"        fill="#1A2B4A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col">
          <p className="text-xs font-bold text-metro-navy uppercase tracking-wide mb-3">
            Atividade Recente
          </p>
          {loadingRecent ? <Spinner /> : !recent || recent.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma atividade recente.</p>
          ) : (
            <div className="flex-1 overflow-auto space-y-1">
              {recent.map(item => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/forms/${item.id}`)}
                  className="w-full flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-gray-50 transition text-left"
                >
                  <div className={`w-1.5 h-8 rounded-full shrink-0 ${
                    item.status === 'pendente'   ? 'bg-yellow-400' :
                    item.status === 'em_analise' ? 'bg-blue-400'   :
                    item.status === 'aprovado'   ? 'bg-green-500'  :
                                                    'bg-red-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-metro-navy truncate">
                      {(item.plan as { title?: string } | null)?.title ?? '—'}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">OS: {item.os_number ?? '—'}</p>
                  </div>
                  <Badge status={item.status} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
