import { useLocation, Link } from 'react-router-dom'
import { CheckCircle, WifiOff } from 'lucide-react'

export function FieldSuccessPage() {
  const location = useLocation()
  const mode = (location.state as { mode?: string })?.mode ?? 'online'

  return (
    <div className="min-h-screen bg-metro-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl p-8 shadow-sm max-w-sm w-full border border-gray-100">
        {mode === 'offline' ? (
          <>
            <WifiOff size={48} className="text-metro-orange mx-auto mb-4" />
            <h2 className="text-xl font-bold text-metro-navy mb-2">Salvo offline</h2>
            <p className="text-sm text-gray-500">
              Formulário salvo localmente. Será enviado automaticamente quando você conectar à internet.
            </p>
          </>
        ) : (
          <>
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-metro-navy mb-2">Enviado com sucesso!</h2>
            <p className="text-sm text-gray-500">
              Formulário submetido. Aguardando revisão da fiscalização.
            </p>
          </>
        )}
        <Link
          to="/field/select"
          className="mt-6 block w-full bg-metro-orange text-white font-semibold py-3 rounded-xl text-sm"
        >
          Novo registro
        </Link>
      </div>
    </div>
  )
}
