'use client'

import { useState } from 'react'
import { AlertCircle, Clock, User, Package, RotateCcw, ChevronRight, FileText, Save, AlertTriangle, Truck, Eye } from 'lucide-react'
import type { Complaint } from '@/lib/api'
import { updateComplaintStage, updateComplaintNotes } from '@/app/actions'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── Timeline de devolução ────────────────────────────────────────────────────

const STAGES: { key: Complaint['stage']; label: string; color: string }[] = [
  { key: 'opened',            label: 'Reclamação aberta',    color: 'bg-red-500' },
  { key: 'mediation',         label: 'Em mediação ML',       color: 'bg-orange-500' },
  { key: 'return_requested',  label: 'Devolução solicitada', color: 'bg-yellow-500' },
  { key: 'return_in_transit', label: 'Produto a caminho',    color: 'bg-blue-500' },
  { key: 'return_received',   label: 'Produto recebido',     color: 'bg-purple-500' },
  { key: 'refunded',          label: 'Reembolso feito',      color: 'bg-green-500' },
]

function ReturnCard({ complaint: initial }: { complaint: Complaint }) {
  const [complaint, setComplaint] = useState(initial)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [saving, setSaving] = useState(false)

  const currentIdx = STAGES.findIndex((s) => s.key === complaint.stage) ?? 0

  const handleStage = async (stage: Complaint['stage']) => {
    setSaving(true)
    const res = await updateComplaintStage(complaint.id, stage!)
    if (!('error' in res)) setComplaint((c) => ({ ...c, stage }))
    setSaving(false)
  }

  const handleSaveNotes = async () => {
    setSaving(true)
    const res = await updateComplaintNotes(complaint.id, notes)
    if (!('error' in res)) {
      setComplaint((c) => ({ ...c, notes }))
      setEditingNotes(false)
    }
    setSaving(false)
  }

  const isSlaBreached = new Date(complaint.slaDeadline) < new Date()

  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
      {/* Cabeçalho */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isSlaBreached && (
                <span className="flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase">
                  <AlertTriangle className="w-3 h-3" /> URGENTE
                </span>
              )}
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mercado Livre</span>
            </div>
            {complaint.buyerName && (
              <div className="flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-sm font-bold text-gray-900">{complaint.buyerName}</span>
              </div>
            )}
            {complaint.itemTitle && (
              <div className="flex items-center gap-1.5 mb-1">
                <Package className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="text-xs text-gray-600 truncate">{complaint.itemTitle}</span>
              </div>
            )}
            <p className="text-sm font-semibold text-gray-800">{complaint.reason}</p>
            <p className="text-xs text-gray-400 mt-0.5">ID: {complaint.externalId}</p>
          </div>
          <span className="shrink-0 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">
            Devolução
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span className={isSlaBreached ? 'text-red-500 font-semibold' : ''}>
            SLA: {formatDate(complaint.slaDeadline)}
          </span>
          <span className="mx-1">·</span>
          <span>Aberta: {formatDate(complaint.createdAt)}</span>
        </div>

        {/* Vistoria pendente */}
        {complaint.vistoraRequired && (
          <div className="flex items-center gap-1.5 mt-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-2xl">
            <Eye className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="text-xs font-semibold text-orange-700">Vistoria pendente — produto aguarda revisão</span>
          </div>
        )}

        {/* Rastreio da devolução */}
        {(complaint.returnShipmentStatus || complaint.returnTrackingCode) && (
          <div className="flex items-center gap-1.5 mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-2xl">
            <Truck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <div className="flex flex-col">
              {complaint.returnShipmentStatus && (
                <span className="text-xs font-semibold text-blue-700 capitalize">
                  Envio: {complaint.returnShipmentStatus.replace(/_/g, ' ')}
                </span>
              )}
              {complaint.returnTrackingCode && (
                <span className="text-[10px] text-blue-500">Rastreio: {complaint.returnTrackingCode}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Etapa atual</p>
        <div className="flex items-center gap-0">
          {STAGES.map((s, i) => {
            const done = i <= currentIdx
            const active = i === currentIdx
            return (
              <button
                key={s.key}
                onClick={() => handleStage(s.key)}
                disabled={saving}
                title={s.label}
                className={`flex-1 h-2 rounded-full transition-all ${
                  done ? s.color : 'bg-gray-200'
                } ${active ? 'ring-2 ring-offset-1 ring-gray-400' : ''} ${i > 0 ? 'ml-1' : ''}`}
              />
            )
          })}
        </div>
        <div className="flex justify-between mt-1">
          {STAGES.map((s, i) => (
            <span
              key={s.key}
              className={`text-[9px] text-center leading-tight ${i === currentIdx ? 'text-gray-700 font-bold' : 'text-gray-400'}`}
              style={{ width: `${100 / STAGES.length}%` }}
            >
              {i === currentIdx ? s.label : ''}
            </span>
          ))}
        </div>

        {/* Botões de avançar etapa */}
        <div className="mt-3 flex flex-wrap gap-2">
          {STAGES.filter((_, i) => i > currentIdx).slice(0, 2).map((s) => (
            <button
              key={s.key}
              onClick={() => handleStage(s.key)}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors disabled:opacity-60"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              {STAGES.find((st) => st.key === s.key)?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notas / Próximos passos */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Próximos Passos</span>
          </div>
          {!editingNotes && (
            <button
              onClick={() => setEditingNotes(true)}
              className="text-xs text-[#DE7100] font-semibold hover:underline"
            >
              {complaint.notes ? 'Editar' : '+ Adicionar nota'}
            </button>
          )}
        </div>

        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ex: Aguardar retorno do produto. Verificar código de rastreio. Reembolso em até 5 dias úteis..."
              className="w-full text-sm px-3 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveNotes}
                disabled={saving}
                className="flex items-center gap-1.5 bg-[#DE7100] text-white text-xs font-bold px-4 py-2 rounded-full disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => { setEditingNotes(false); setNotes(complaint.notes ?? '') }}
                className="text-xs text-gray-500 px-3 py-2 rounded-full border border-gray-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : complaint.notes ? (
          <p className="text-sm text-gray-700 bg-yellow-50 rounded-2xl px-4 py-3 border border-yellow-200 whitespace-pre-wrap">
            {complaint.notes}
          </p>
        ) : (
          <p className="text-xs text-gray-400 italic">Nenhuma nota adicionada</p>
        )}
      </div>
    </div>
  )
}

// ─── Layout principal ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = { open: 'Aberta', pending: 'Pendente', closed: 'Encerrada' }
const STATUS_COLOR: Record<string, string> = {
  open: 'bg-red-100 text-red-600',
  pending: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-green-100 text-green-600',
}

type Props = { complaints: Complaint[] }

export default function ReclamacoesLayout({ complaints }: Props) {
  const [tab, setTab] = useState<'reclamacoes' | 'devolucoes'>('reclamacoes')

  const regular = complaints.filter((c) => !c.isReturn)
  const returns = complaints.filter((c) => c.isReturn)
  const urgentCount = complaints.filter((c) => !c.isReturn && new Date(c.slaDeadline) < new Date() && c.status !== 'closed').length

  return (
    <div className="flex gap-4 min-h-[70vh]">
      {/* Sidebar vertical esquerda */}
      <div className="w-44 shrink-0 flex flex-col gap-2 pt-1">
        <button
          onClick={() => setTab('reclamacoes')}
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors text-left ${
            tab === 'reclamacoes'
              ? 'bg-[#DE7100] text-white shadow-md shadow-orange-200'
              : 'bg-white text-gray-600 border border-gray-100 hover:border-orange-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">Reclamações</span>
          {urgentCount > 0 && (
            <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ${tab === 'reclamacoes' ? 'bg-white text-red-500' : 'bg-red-500 text-white'}`}>
              {urgentCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('devolucoes')}
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors text-left ${
            tab === 'devolucoes'
              ? 'bg-[#DE7100] text-white shadow-md shadow-orange-200'
              : 'bg-white text-gray-600 border border-gray-100 hover:border-orange-200'
          }`}
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span className="flex-1">Devoluções</span>
          {returns.length > 0 && (
            <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ${tab === 'devolucoes' ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'}`}>
              {returns.length}
            </span>
          )}
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">

      {/* Reclamações regulares */}
      {tab === 'reclamacoes' && (
        <div className="space-y-3 pb-8">
          {!regular.length ? (
            <div className="text-center py-16 text-gray-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma reclamação encontrada</p>
            </div>
          ) : regular.map((c) => (
            <div key={c.id} className="bg-white rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{c.marketplace}</p>
                  {new Date(c.slaDeadline) < new Date() && c.status !== 'closed' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase mb-1 w-fit">
                      <AlertTriangle className="w-3 h-3" /> URGENTE
                    </span>
                  )}
                  {c.buyerName && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <User className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="text-sm font-bold text-gray-900 truncate">{c.buyerName}</span>
                    </div>
                  )}
                  {c.itemTitle && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <Package className="w-3 h-3 text-orange-400 shrink-0" />
                      <span className="text-xs text-gray-600 truncate">{c.itemTitle}</span>
                    </div>
                  )}
                  <p className="text-sm text-gray-700">{c.reason}</p>
                  <p className="text-xs text-gray-400 mt-0.5">ID: {c.externalId}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 border-t border-gray-50 pt-2">
                <Clock className="w-3.5 h-3.5" />
                <span className={new Date(c.slaDeadline) < new Date() && c.status !== 'closed' ? 'text-red-500 font-semibold' : ''}>
                  SLA: {formatDate(c.slaDeadline)}
                </span>
                <span className="mx-1">·</span>
                <span>Criada: {formatDate(c.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Devoluções */}
      {tab === 'devolucoes' && (
        <div className="space-y-4 pb-8">
          {!returns.length ? (
            <div className="text-center py-16 text-gray-400">
              <RotateCcw className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma devolução encontrada</p>
              <p className="text-xs mt-1">Devoluções aparecem automaticamente ao sincronizar</p>
            </div>
          ) : returns.map((c) => <ReturnCard key={c.id} complaint={c} />)}
        </div>
      )}

      </div> {/* fim conteúdo */}
    </div>
  )
}
