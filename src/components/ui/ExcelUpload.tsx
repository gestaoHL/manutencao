import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'

export interface ExcelColumn {
  key: string
  label: string
  required?: boolean
}

interface Props {
  columns: ExcelColumn[]
  onImport: (rows: Record<string, string>[]) => Promise<{ success: number; errors: string[] }>
  templateName: string
}

export function ExcelUpload({ columns, onImport, templateName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null)
  const [importing, setImporting] = useState(false)

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([columns.map(c => c.label)])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Dados')
    XLSX.writeFile(wb, `modelo-${templateName}.xlsx`)
  }

  function handleFile(file: File) {
    setParseError(null)
    setResult(null)
    setPreview(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })
        if (!raw || raw.length < 2) { setParseError('Planilha vazia ou sem dados.'); return }

        const header = (raw[0] as string[]).map(h => String(h ?? '').trim())
        const rows: Record<string, string>[] = []

        for (let i = 1; i < raw.length; i++) {
          const rowArr = raw[i] as unknown[]
          if (!rowArr || rowArr.every(v => v === null || v === undefined || v === '')) continue
          const row: Record<string, string> = {}
          columns.forEach(col => {
            const idx = header.findIndex(h => h.toLowerCase() === col.label.toLowerCase())
            row[col.key] = idx >= 0 ? String(rowArr[idx] ?? '').trim() : ''
          })
          rows.push(row)
        }

        if (rows.length === 0) { setParseError('Nenhuma linha de dados encontrada.'); return }
        setPreview(rows)
      } catch {
        setParseError('Erro ao ler o arquivo. Verifique se é um .xlsx válido.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (!preview) return
    setImporting(true)
    try {
      const res = await onImport(preview)
      setResult(res)
      setPreview(null)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Importar via planilha</p>
        <button
          onClick={downloadTemplate}
          className="text-xs text-metro-orange hover:underline flex items-center gap-1"
        >
          <Upload size={11} /> Baixar modelo
        </button>
      </div>

      {!preview && !result && (
        <label className="flex flex-col items-center gap-2 cursor-pointer py-4 hover:bg-gray-50 rounded-lg transition">
          <Upload size={22} className="text-gray-300" />
          <span className="text-xs text-gray-400">Clique para selecionar o arquivo .xlsx</span>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }}
          />
        </label>
      )}

      {parseError && (
        <p className="text-xs text-red-500 flex items-center gap-1.5">
          <AlertTriangle size={13} /> {parseError}
        </p>
      )}

      {preview && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">{preview.length} linha{preview.length !== 1 ? 's' : ''} encontrada{preview.length !== 1 ? 's' : ''}</p>
            <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          <div className="overflow-auto max-h-40 border border-gray-100 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map(c => <th key={c.key} className="text-left px-2 py-1.5 text-gray-500 font-semibold">{c.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {columns.map(c => <td key={c.key} className="px-2 py-1.5 text-gray-600 truncate max-w-[120px]">{row[c.key] || '—'}</td>)}
                  </tr>
                ))}
                {preview.length > 5 && (
                  <tr><td colSpan={columns.length} className="px-2 py-1.5 text-gray-400 text-center">… e mais {preview.length - 5} linha{preview.length - 5 !== 1 ? 's' : ''}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Button size="sm" loading={importing} onClick={handleImport} className="w-full">
            Importar {preview.length} registro{preview.length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {result && (
        <div className={`rounded-lg p-3 text-xs space-y-1 ${result.errors.length === 0 ? 'bg-green-50' : 'bg-amber-50'}`}>
          <p className="flex items-center gap-1.5 font-semibold text-green-700">
            <CheckCircle size={13} /> {result.success} registro{result.success !== 1 ? 's' : ''} importado{result.success !== 1 ? 's' : ''} com sucesso
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-red-600 flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{e}</p>
          ))}
          <button onClick={() => setResult(null)} className="text-gray-400 hover:text-gray-600 text-xs underline">Importar outra planilha</button>
        </div>
      )}
    </div>
  )
}
