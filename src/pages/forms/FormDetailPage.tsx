import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronLeft, CheckCircle, XCircle, Clock, Eye,
  ChevronDown, ChevronUp, User, FileText, StickyNote, Ban, ExternalLink,
  FlaskConical, AlertTriangle, ShieldCheck, ShieldX
} from 'lucide-react'
import { useExecution, useUpdateExecutionStatus } from '@/hooks/useExecutions'
import { useExecutionHistory } from '@/hooks/useHistory'
import { useFormMetadata, formKeyFromUrl as formKeyFromPath } from '@/hooks/useFormMetadata'
import { useEmployees } from '@/hooks/useEmployees'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'

const rejectSchema = z.object({
  rejection_reason: z.string().min(10, 'Descreva o motivo (mínimo 10 caracteres)'),
})
type RejectForm = z.infer<typeof rejectSchema>

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  rejection_reason: 'Motivo de Rejeição',
}

/** Extrai operador e limite de uma string como "≥ 2 MΩ", "≤ 60 μΩ" ou ">= 2 MΩ" */
function parseRef(refStr: string): { op: string; limit: number } | null {
  const m = refStr.match(/(>=|<=|≥|≤|>|<)\s*([\d.,]+)/)
  if (!m) return null
  const op = m[1] === '>=' ? '≥' : m[1] === '<=' ? '≤' : m[1]
  return { op, limit: parseFloat(m[2].replace(',', '.')) }
}

/** Retorna 'ok', 'fail' ou null se não aplicável */
function checkRef(refStr: string | undefined, value: unknown): 'ok' | 'fail' | null {
  if (!refStr) return null
  const num = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN
  if (isNaN(num)) return null
  const p = parseRef(refStr)
  if (!p) return null
  if (p.op === '≥') return num >= p.limit ? 'ok' : 'fail'
  if (p.op === '≤') return num <= p.limit ? 'ok' : 'fail'
  if (p.op === '>')  return num >  p.limit ? 'ok' : 'fail'
  if (p.op === '<')  return num <  p.limit ? 'ok' : 'fail'
  return null
}

/** Formata uma chave técnica como label legível de fallback */
function formatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b(\w)/g, c => c.toUpperCase())
}

const STATUS_PT: Record<string, string> = {
  pendente:   'Pendente',
  recebido:   'Recebido',
  em_analise: 'Em Análise',
  aprovado:   'Aprovado',
  rejeitado:  'Rejeitado',
  cancelado:  'Cancelado',
}

interface ExecutanteCheck {
  matricula: string
  nome_informado?: string
  found: boolean
  ativo: boolean
}

interface ParamCheck {
  label: string
  key: string
  value: unknown
  ref: string
  unit: string
  result: 'ok' | 'fail'
}

interface AnalysisResult {
  executantes: ExecutanteCheck[]
  params: ParamCheck[]
  allExecutantesOk: boolean
  allParamsOk: boolean
}

export function FormDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [showHistory, setShowHistory] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)
  const [internalNotes, setInternalNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const { data: exec, isLoading } = useExecution(id ?? '')
  const { data: history } = useExecutionHistory(id ?? '')
  const formKey = formKeyFromPath(exec?.plan?.forms_catalog?.path)
  const { data: formMeta } = useFormMetadata(formKey)
  const updateStatus = useUpdateExecutionStatus()
  const { data: allEmployees = [] } = useEmployees(exec?.company_id ?? undefined)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)

  function runAnalysis() {
    if (!exec) return
    const fd = exec.form_data ?? {}

    // 1. Verificar executantes
    const executantesRaw = (
      (fd._executantes as { matricula?: string; nome?: string }[] | undefined) ??
      (fd.executantes  as { matricula?: string; nome?: string }[] | undefined) ?? []
    )
    const executantes: ExecutanteCheck[] = executantesRaw.map(e => {
      const mat = (e.matricula ?? '').trim()
      const found = allEmployees.find(emp => emp.matricula.trim() === mat)
      return {
        matricula: mat || '—',
        nome_informado: e.nome,
        found: !!found,
        ativo: found?.status === 'ativo',
      }
    })

    // 2. Verificar parâmetros fora da referência
    const metaFields = formMeta?.fields ?? []
    const savedLabels = (fd._labels as Record<string, string> | undefined) ?? {}
    const savedRefs   = (fd._refs   as Record<string, string> | undefined) ?? {}
    const params: ParamCheck[] = []

    // Usa metadados da tabela quando disponível; caso contrário usa _refs salvo no form_data
    const fieldsToCheck = metaFields.length > 0
      ? metaFields.filter(f => !!f.ref).map(f => ({ key: f.key, ref: f.ref!, label: f.label, unit: f.unit ?? '' }))
      : Object.entries(savedRefs).map(([key, ref]) => ({
          key,
          ref,
          label: savedLabels[key] || formatKey(key),
          unit: '',
        }))

    for (const field of fieldsToCheck) {
      const value = fd[field.key]
      if (value === undefined || value === null || value === '') continue
      const check = checkRef(field.ref, value)
      if (check !== null) {
        params.push({
          label: savedLabels[field.key] || field.label,
          key: field.key,
          value,
          ref: field.ref,
          unit: field.unit,
          result: check,
        })
      }
    }

    setAnalysisResult({
      executantes,
      params,
      allExecutantesOk: executantes.every(e => e.found && e.ativo),
      allParamsOk: params.every(p => p.result === 'ok'),
    })
  }

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RejectForm>({
    resolver: zodResolver(rejectSchema),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-metro-bg flex items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!exec) {
    return <div className="p-4 text-center text-gray-500">Formulário não encontrado.</div>
  }

  const canAnalyze = profile?.role === 'fiscalizacao' || profile?.role === 'admin' || profile?.role === 'gestor'
  const canCancel = profile?.role === 'admin' || profile?.role === 'gestor'
  const isContratada = profile?.role === 'contratada'

  async function handleStartAnalysis() {
    if (!exec || exec.status !== 'recebido') return
    setActionLoading(true)
    try {
      await updateStatus.mutateAsync({
        id: exec.id,
        status: 'em_analise',
        internal_notes: internalNotes || undefined,
      })
      setShowAnalysisModal(false)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleApprove() {
    if (!exec) return
    setActionLoading(true)
    try {
      await updateStatus.mutateAsync({ id: exec.id, status: 'aprovado' })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject(data: RejectForm) {
    if (!exec) return
    setActionLoading(true)
    try {
      await updateStatus.mutateAsync({
        id: exec.id,
        status: 'rejeitado',
        rejection_reason: data.rejection_reason,
      })
      setShowRejectModal(false)
      reset()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleResubmit() {
    if (!exec) return
    setActionLoading(true)
    try {
      await updateStatus.mutateAsync({ id: exec.id, status: 'pendente' })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-metro-bg pb-8">
      {/* Header */}
      <div className="bg-metro-navy px-4 pt-4 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm truncate">{exec.plan?.title ?? '—'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge status={exec.status} />
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${exec.plan_type === 'preventiva' ? 'bg-orange-200 text-metro-orange' : 'bg-blue-200 text-blue-700'}`}>
                {exec.plan_type === 'preventiva' ? 'Preventiva' : 'IRQ'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {/* Identification */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-metro-navy uppercase tracking-wide mb-3">Identificação</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Número da OS</p>
              <p className="font-medium text-metro-navy">{exec.os_number ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Item da PSA</p>
              <p className="font-medium text-metro-navy">{exec.psa_item ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Localidade</p>
              <p className="font-medium text-metro-navy">
                {exec.locality?.name ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Data Programada</p>
              <p className="font-medium text-metro-navy">
                {exec.scheduled_date
                  ? new Date(exec.scheduled_date + 'T00:00:00').toLocaleDateString('pt-BR')
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Criado em</p>
              <p className="font-medium text-metro-navy">{new Date(exec.created_at).toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* Form link */}
        {exec.plan?.forms_catalog?.path && (() => {
          const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
          const fp = exec.plan.forms_catalog.path
          const formUrl = fp.startsWith('/') ? window.location.origin + basePath + fp + '?id=' + exec.id : fp + '?id=' + exec.id
          return (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-metro-navy uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileText size={12} /> Formulário da OS
              </p>
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                <ExternalLink size={13} className="text-blue-400 shrink-0" />
                <span className="flex-1 text-xs text-blue-600 font-mono truncate">{fp}</span>
                <a
                  href={formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
                >
                  Abrir
                </a>
              </div>
            </div>
          )
        })()}

        {/* Form data */}
        {Object.keys(exec.form_data).length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-metro-navy uppercase tracking-wide mb-3">Dados do Formulário</p>
            <div className="space-y-3">
              {Object.entries(exec.form_data).map(([key, value]) => (
                <div key={key} className="border-b border-gray-50 pb-2 last:border-0">
                  <p className="text-xs text-gray-400">{key}</p>
                  <p className="text-sm font-medium text-metro-navy">
                    {typeof value === 'boolean'
                      ? (value ? 'Sim ✓' : 'Não ✗')
                      : String(value ?? '—')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejection reason */}
        {exec.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Motivo da Rejeição</p>
            <p className="text-sm text-red-800">{exec.rejection_reason}</p>
          </div>
        )}

        {/* Resultado da análise */}
        {analysisResult && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-2">
              <FlaskConical size={14} className="text-metro-navy" />
              <p className="text-xs font-bold text-metro-navy uppercase tracking-wide">Resultado da Análise Automática</p>
            </div>

            {/* Executantes */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                {analysisResult.allExecutantesOk
                  ? <ShieldCheck size={13} className="text-green-600" />
                  : <ShieldX size={13} className="text-red-500" />
                }
                <p className="text-xs font-semibold text-gray-700">Executantes</p>
              </div>
              {analysisResult.executantes.length === 0 ? (
                <p className="text-xs text-gray-400 pl-4">Nenhum executante informado no formulário.</p>
              ) : (
                <div className="space-y-1.5 pl-2">
                  {analysisResult.executantes.map((e, i) => (
                    <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                      e.found && e.ativo ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
                    }`}>
                      {e.found && e.ativo
                        ? <CheckCircle size={12} className="text-green-600 shrink-0" />
                        : <XCircle size={12} className="text-red-500 shrink-0" />
                      }
                      <span className="font-mono font-semibold text-gray-700">{e.matricula}</span>
                      {e.nome_informado && <span className="text-gray-500">— {e.nome_informado}</span>}
                      <span className={`ml-auto font-semibold ${e.found && e.ativo ? 'text-green-600' : 'text-red-500'}`}>
                        {!e.found ? 'Não cadastrado' : !e.ativo ? 'Inativo' : 'Autorizado'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Parâmetros */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                {analysisResult.allParamsOk
                  ? <ShieldCheck size={13} className="text-green-600" />
                  : <AlertTriangle size={13} className="text-amber-500" />
                }
                <p className="text-xs font-semibold text-gray-700">Parâmetros com Referência</p>
              </div>
              {analysisResult.params.length === 0 ? (
                <p className="text-xs text-gray-400 pl-4">Nenhum parâmetro com referência encontrado.</p>
              ) : (
                <div className="space-y-1.5 pl-2">
                  {analysisResult.params.map((p, i) => (
                    <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                      p.result === 'ok' ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
                    }`}>
                      {p.result === 'ok'
                        ? <CheckCircle size={12} className="text-green-600 shrink-0" />
                        : <XCircle size={12} className="text-red-500 shrink-0" />
                      }
                      <span className="flex-1 text-gray-700">{p.label}</span>
                      <span className={`font-semibold ${p.result === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
                        {String(p.value)}{p.unit ? ` ${p.unit}` : ''}
                      </span>
                      <span className="text-gray-400">({p.ref})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumo */}
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 ${
              analysisResult.allExecutantesOk && analysisResult.allParamsOk
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {analysisResult.allExecutantesOk && analysisResult.allParamsOk
                ? <><CheckCircle size={15} /> Todos os critérios atendidos — OS apta para aprovação.</>
                : <><XCircle size={15} /> Foram encontradas divergências — revisar antes de aprovar.</>
              }
            </div>
          </div>
        )}

        {/* Ações de análise */}
        {canAnalyze && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-metro-navy uppercase tracking-wide mb-3">Ações</p>
            <div className="flex gap-3 flex-wrap">
              {exec.status === 'recebido' && (
                <Button variant="secondary" onClick={() => { setInternalNotes(exec.internal_notes ?? ''); setShowAnalysisModal(true) }} className="flex-1">
                  <Eye size={15} /> Iniciar Análise
                </Button>
              )}
              {exec.status === 'em_analise' && (
                <>
                  <Button
                    variant="secondary"
                    onClick={runAnalysis}
                    className="flex-1 !border-metro-navy !text-metro-navy hover:!bg-metro-navy hover:!text-white"
                  >
                    <FlaskConical size={15} /> Analisar
                  </Button>
                  <Button onClick={handleApprove} loading={actionLoading} className="flex-1 !bg-green-600 hover:!bg-green-700">
                    <CheckCircle size={15} /> Aprovar
                  </Button>
                  <Button variant="danger" onClick={() => setShowRejectModal(true)} loading={actionLoading} className="flex-1">
                    <XCircle size={15} /> Rejeitar
                  </Button>
                </>
              )}
              {exec.status === 'pendente' && (
                <p className="text-sm text-gray-400">Aguardando preenchimento pelo operador de campo.</p>
              )}
              {exec.status === 'aprovado' && (
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  <CheckCircle size={16} /> Formulário aprovado
                </div>
              )}
              {exec.status === 'rejeitado' && (
                <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
                  <XCircle size={16} /> Aguardando correção da contratada
                </div>
              )}
              {exec.status === 'cancelado' && (
                <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                  <Ban size={16} /> OS cancelada
                </div>
              )}
              {/* Cancelar — disponível para admin/gestor enquanto não aprovado/cancelado */}
              {canCancel && !['aprovado', 'cancelado'].includes(exec.status) && (
                <Button
                  variant="secondary"
                  onClick={() => updateStatus.mutateAsync({ id: exec.id, status: 'cancelado' })}
                  loading={actionLoading}
                  className="ml-auto !text-gray-400 hover:!text-red-500"
                >
                  <Ban size={14} /> Cancelar OS
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Notas internas (visível apenas para quem pode analisar) */}
        {canAnalyze && exec.internal_notes && exec.status !== 'recebido' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <StickyNote size={13} className="text-amber-600" />
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Notas Internas</p>
            </div>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{exec.internal_notes}</p>
          </div>
        )}

        {/* Contratada resubmit */}
        {isContratada && exec.status === 'rejeitado' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-metro-navy uppercase tracking-wide mb-2">Ação da Contratada</p>
            <p className="text-sm text-gray-500 mb-3">
              Corrija os problemas indicados no motivo de rejeição e reenvie para análise.
            </p>
            <Button onClick={handleResubmit} loading={actionLoading} className="w-full">
              <Clock size={15} /> Reenviar para Análise
            </Button>
          </div>
        )}

        {/* Audit log */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4"
            onClick={() => setShowHistory(!showHistory)}
          >
            <p className="text-xs font-bold text-metro-navy uppercase tracking-wide">
              Histórico de Alterações {history?.length ? `(${history.length})` : ''}
            </p>
            {showHistory
              ? <ChevronUp size={16} className="text-gray-400" />
              : <ChevronDown size={16} className="text-gray-400" />
            }
          </button>
          {showHistory && (
            <div className="border-t border-gray-100">
              {!history || history.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Nenhuma alteração registrada.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {history.map(entry => (
                    <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="w-7 h-7 bg-metro-navy/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        <User size={13} className="text-metro-navy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400">
                          {new Date(entry.changed_at).toLocaleString('pt-BR')}
                          {entry.changer?.full_name ? ` · ${entry.changer.full_name}` : ''}
                        </p>
                        <p className="text-sm text-metro-navy mt-0.5">
                          <span className="font-medium">{FIELD_LABELS[entry.field_name] ?? entry.field_name}:</span>{' '}
                          <span className="text-gray-400 line-through text-xs">
                            {STATUS_PT[entry.old_value ?? ''] ?? entry.old_value ?? '—'}
                          </span>
                          {' → '}
                          <span className="font-semibold">
                            {STATUS_PT[entry.new_value ?? ''] ?? entry.new_value ?? '—'}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Iniciar Análise */}
      <Modal
        open={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
        title="Revisar Formulário — Iniciar Análise"
      >
        <div className="space-y-4">
          {/* Form data */}
          {(() => {
            const fd = exec?.form_data ?? {}
            const dataKeys = Object.keys(fd).filter(k => !k.startsWith('_'))
            if (dataKeys.length === 0) return (
              <div className="rounded-xl border border-gray-200 p-4 text-center text-sm text-gray-400">
                Nenhum dado de formulário registrado nesta OS.
              </div>
            )

            // Usa metadados da tabela form_field_metadata; fallback para _labels/_section salvos no form_data (OSs antigas)
            const metaFields  = formMeta?.fields ?? []
            const labels      = metaFields.length > 0
              ? Object.fromEntries(metaFields.map(f => [f.key, f.label]))
              : (fd._labels  as Record<string,string>) ?? {}
            const sectionMap  = metaFields.length > 0
              ? Object.fromEntries(metaFields.map(f => [f.key, f.section]))
              : (fd._section as Record<string,string>) ?? {}
            const unitMap     = Object.fromEntries(metaFields.map(f => [f.key, f.unit ?? ''])) as Record<string,string>
            const refMap      = Object.fromEntries(metaFields.map(f => [f.key, f.ref  ?? ''])) as Record<string,string>
            const executantes  = fd._executantes as { matricula?: string; inicio?: string; fim?: string }[] | undefined
            const instrumentos = fd._instrumentos as { nome?: string; tag?: string }[] | undefined

            const entries = Object.entries(fd).filter(([k, v]) => !k.startsWith('_') && v !== null && v !== '')
            const groups: Record<string, [string, unknown][]> = {}
            entries.forEach(([k, v]) => {
              const sec = sectionMap[k] ?? 'Dados do Formulário'
              if (!groups[sec]) groups[sec] = []
              groups[sec].push([k, v])
            })

            return (
              <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 text-sm">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center gap-2 sticky top-0 z-10">
                  <FileText size={13} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dados preenchidos pelo operador</span>
                </div>

                {Object.entries(groups).map(([sec, rows]) => (
                  <div key={sec}>
                    <div className="bg-metro-navy/5 px-3 py-1.5 border-y border-gray-100 sticky top-8 z-[9]">
                      <span className="text-[11px] font-bold text-metro-navy uppercase tracking-wide">{sec}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {rows.map(([key, value]) => {
                        const label   = labels[key] || formatKey(key)
                        const isBool  = value === 'Sim' || value === 'Não' || value === 'N/A'
                        const refStr  = refMap[key]
                        const unitVal = unitMap[key]
                        const compliance = checkRef(refStr, value)
                        const rowBg = compliance === 'fail' ? 'bg-red-50' : ''

                        return (
                          <div key={key} className={`flex items-start gap-3 px-3 py-2 ${rowBg}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-700 leading-snug">{label}</p>
                              {refStr && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  Ref: <span className="font-medium">{refStr}</span>
                                </p>
                              )}
                            </div>

                            {isBool ? (
                              <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                                value === 'Sim' ? 'bg-green-100 text-green-700' :
                                value === 'Não' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>{String(value)}</span>
                            ) : (
                              <div className="shrink-0 flex items-center gap-1.5">
                                {compliance === 'fail' && (
                                  <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                                    ⚠ Fora da faixa
                                  </span>
                                )}
                                <span className={`text-xs font-semibold text-right ${
                                  compliance === 'fail' ? 'text-red-700' :
                                  compliance === 'ok'   ? 'text-green-700' :
                                  'text-metro-navy'
                                }`}>
                                  {String(value)}{unitVal ? ` ${unitVal}` : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {executantes && executantes.length > 0 && (
                  <div>
                    <div className="bg-metro-navy/5 px-3 py-1.5 border-y border-gray-100">
                      <span className="text-[11px] font-bold text-metro-navy uppercase tracking-wide">Executantes</span>
                    </div>
                    {executantes.map((e, i) => (
                      <div key={i} className="px-3 py-2 text-xs text-metro-navy border-b border-gray-50">
                        <span className="font-semibold">{e.matricula ?? '—'}</span>
                        {e.inicio && <span className="text-gray-400"> · início: {e.inicio}</span>}
                        {e.fim    && <span className="text-gray-400"> · fim: {e.fim}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {instrumentos && instrumentos.length > 0 && (
                  <div>
                    <div className="bg-metro-navy/5 px-3 py-1.5 border-y border-gray-100">
                      <span className="text-[11px] font-bold text-metro-navy uppercase tracking-wide">Instrumentos Utilizados</span>
                    </div>
                    {instrumentos.map((inst, idx) => (
                      <div key={idx} className="px-3 py-2 flex items-center justify-between text-xs border-b border-gray-50">
                        <span className="text-metro-navy">{inst.nome ?? '—'}</span>
                        {inst.tag && <span className="text-gray-400 font-mono">{inst.tag}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Notas internas */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <StickyNote size={13} className="text-amber-500" />
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Notas Internas
              </label>
              <span className="text-[10px] text-gray-400">(não enviadas à contratada)</span>
            </div>
            <textarea
              value={internalNotes}
              onChange={e => setInternalNotes(e.target.value)}
              rows={3}
              placeholder="Registre observações internas sobre esta OS..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange resize-none"
            />
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowAnalysisModal(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleStartAnalysis} loading={actionLoading} className="flex-1">
              <Eye size={15} /> Confirmar Análise
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal
        open={showRejectModal}
        onClose={() => { setShowRejectModal(false); reset() }}
        title="Rejeitar Formulário"
      >
        <form onSubmit={handleSubmit(handleReject)} className="space-y-4">
          <p className="text-sm text-gray-500">
            Descreva claramente o motivo da rejeição para que a contratada possa corrigir.
          </p>
          <div>
            <label className="block text-xs font-semibold text-metro-navy mb-1">
              Motivo da Rejeição *
            </label>
            <textarea
              {...register('rejection_reason')}
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange resize-none"
              placeholder="Descreva o motivo da rejeição..."
            />
            {errors.rejection_reason && (
              <p className="text-xs text-red-500 mt-1">{errors.rejection_reason.message}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowRejectModal(false); reset() }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" variant="danger" loading={actionLoading} className="flex-1">
              Confirmar Rejeição
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
