import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

const schema = z.object({
  full_name:    z.string().min(3, 'Nome obrigatório'),
  company_name: z.string().optional(),
  role:         z.enum(['gestor', 'fiscalizacao', 'contratada']),
  email:        z.string().email('E-mail inválido'),
  password:     z.string().min(6, 'Mínimo 6 caracteres'),
})
type FormData = z.infer<typeof schema>

const roleOptions = [
  { value: 'gestor',         label: 'Gestor de Contrato' },
  { value: 'fiscalizacao',   label: 'Fiscalização' },
  { value: 'contratada',     label: 'Contratada' },
  { value: 'operador_campo', label: 'Operador de Campo' },
]

export function RegisterPage() {
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'contratada' },
  })

  const onSubmit = async (data: FormData) => {
    setServerError(null)
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.full_name, company_name: data.company_name, role: data.role },
      },
    })
    if (error) { setServerError(error.message); return }
    setSuccess(true)
  }

  if (success) return (
    <div className="min-h-screen bg-metro-bg flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="font-bold text-metro-navy text-xl mb-2">Cadastro enviado!</h2>
        <p className="text-gray-500 text-sm mb-6">
          Seu acesso será analisado pelo administrador. Você receberá confirmação por e-mail.
        </p>
        <Link to="/login"><Button variant="secondary">Voltar ao Login</Button></Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-metro-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-metro-orange flex items-center justify-center font-black text-white text-2xl shadow-lg">M</div>
          <div>
            <p className="font-black text-metro-navy text-lg leading-tight">Metrô-DF</p>
            <p className="text-xs text-gray-500 leading-tight">Solicitar Acesso</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h1 className="text-metro-navy font-bold text-xl mb-1">Solicitar Acesso</h1>
          <p className="text-gray-500 text-sm mb-5">Preencha para que o admin avalie seu cadastro</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Nome completo" error={errors.full_name?.message} {...register('full_name')} />
            <Input label="Empresa (opcional)" {...register('company_name')} />
            <Select label="Perfil solicitado" options={roleOptions} error={errors.role?.message} {...register('role')} />
            <Input label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
            <Input label="Senha" type="password" error={errors.password?.message} {...register('password')} />
            {serverError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{serverError}</p>}
            <Button type="submit" className="w-full" loading={isSubmitting}>Solicitar Acesso</Button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Já tem conta? <Link to="/login" className="text-metro-orange font-medium hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
