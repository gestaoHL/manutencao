import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui/Spinner'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { HomePage } from '@/pages/home/HomePage'
import { AccessManagementPage } from '@/pages/admin/AccessManagementPage'
import { SettingsPage } from '@/pages/admin/SettingsPage'
import { ContractsListPage } from '@/pages/contracts/ContractsListPage'
import { ContractDetailPage } from '@/pages/contracts/ContractDetailPage'
import { ContractFormPage } from '@/pages/contracts/ContractFormPage'
import { CommitmentNotesPage } from '@/pages/contracts/CommitmentNotesPage'
import { BudgetExecutionPage } from '@/pages/contracts/BudgetExecutionPage'
import { MaintenancePlansPage } from '@/pages/maintenance/MaintenancePlansPage'
import { MaintenanceExecutionsPage } from '@/pages/maintenance/MaintenanceExecutionsPage'
import { IRQExecutionsPage } from '@/pages/irq/IRQExecutionsPage'
import { FieldSelectPage } from '@/pages/field/FieldSelectPage'
import { FieldFormPage } from '@/pages/field/FieldFormPage'
import { FieldSuccessPage } from '@/pages/field/FieldSuccessPage'
import { FieldPendingOSPage } from '@/pages/field/FieldPendingOSPage'
import { FormDetailPage } from '@/pages/forms/FormDetailPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import type { UserRole } from '@/types'

// Renders AppShell + checks auth/approval
function RequireAuth() {
  const { profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.status !== 'approved') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="font-bold text-metro-navy text-xl mb-2">Acesso Pendente</h2>
        <p className="text-gray-500 text-sm">Seu cadastro está aguardando aprovação do administrador.</p>
      </div>
    </div>
  )
  // Operador de campo vai direto para a tela de OSs pendentes, sem AppShell
  if (profile.role === 'operador_campo') return <Navigate to="/field/pending" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

// Only checks role — no AppShell (already inside one)
function RequireRole({ roles }: { roles: UserRole[] }) {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (!profile) return <Navigate to="/login" replace />
  if (!roles.includes(profile.role)) return <Navigate to="/" replace />
  return <Outlet />
}

export const router = createBrowserRouter([
  { path: '/login',    element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // Public field operator routes (no auth required)
  { path: '/field/select',       element: <FieldSelectPage /> },
  { path: '/field/pending',      element: <FieldPendingOSPage /> },
  { path: '/field/form/:planId', element: <FieldFormPage /> },
  { path: '/field/success',      element: <FieldSuccessPage /> },

  {
    element: <RequireAuth />,
    children: [
      { path: '/',                        element: <HomePage /> },
      { path: '/contracts',               element: <ContractsListPage /> },
      { path: '/contracts/new',           element: <ContractFormPage /> },
      { path: '/contracts/:id',           element: <ContractDetailPage /> },
      { path: '/contracts/:id/edit',      element: <ContractFormPage /> },
      { path: '/empenhos',                element: <CommitmentNotesPage /> },
      { path: '/execucao',                element: <BudgetExecutionPage /> },
      { path: '/maintenance',             element: <MaintenancePlansPage /> },
      { path: '/maintenance/executions',  element: <MaintenanceExecutionsPage /> },
      { path: '/irq',                     element: <IRQExecutionsPage /> },
      { path: '/forms/:id',               element: <FormDetailPage /> },
      { path: '/dashboard',               element: <DashboardPage /> },
      { path: '/reports',                 element: <ReportsPage /> },
      {
        element: <RequireRole roles={['admin']} />,
        children: [
          { path: '/admin/access',    element: <AccessManagementPage /> },
          { path: '/admin/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
