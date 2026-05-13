import { clsx } from 'clsx'

type BadgeVariant = 'active' | 'suspended' | 'expired' | 'terminated' |
                   'pending' | 'approved' | 'rejected' | 'em_analise' |
                   'pendente' | 'recebido' | 'aprovado' | 'rejeitado' | 'cancelado' | 'default'

const variantClasses: Record<BadgeVariant, string> = {
  active:      'bg-green-100 text-green-800',
  approved:    'bg-green-100 text-green-800',
  aprovado:    'bg-green-100 text-green-800',
  pending:     'bg-yellow-100 text-yellow-800',
  pendente:    'bg-yellow-100 text-yellow-800',
  recebido:    'bg-purple-100 text-purple-800',
  suspended:   'bg-orange-100 text-orange-800',
  em_analise:  'bg-blue-100 text-blue-800',
  expired:     'bg-gray-100 text-gray-600',
  terminated:  'bg-red-100 text-red-700',
  rejected:    'bg-red-100 text-red-700',
  rejeitado:   'bg-red-100 text-red-700',
  cancelado:   'bg-gray-200 text-gray-500',
  default:     'bg-gray-100 text-gray-600',
}

const labels: Record<BadgeVariant, string> = {
  active:     'Ativo',
  approved:   'Aprovado',
  aprovado:   'Aprovado',
  pending:    'Pendente',
  pendente:   'Pendente',
  recebido:   'Recebido',
  suspended:  'Suspenso',
  em_analise: 'Em Análise',
  expired:    'Expirado',
  terminated: 'Encerrado',
  rejected:   'Rejeitado',
  rejeitado:  'Rejeitado',
  cancelado:  'Cancelado',
  default:    'Desconhecido',
}

export function Badge({ status }: { status: string }) {
  const variant = (status as BadgeVariant) in variantClasses
    ? (status as BadgeVariant)
    : 'default'
  return (
    <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', variantClasses[variant])}>
      {labels[variant]}
    </span>
  )
}
