import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import StatusStamp from '../components/StatusStamp'
import { supabase } from '../lib/supabaseClient'
import { downloadPackingListCsv } from '../lib/exportCsv'
import { formatServiceType, formatRoute } from '../lib/labels'

// An order stays editable by the customer up through "received" —
// once it's in_transit (shipped) or further along, only admin can
// change anything on it, full stop.
const EDITABLE_STATUSES = ['submitted', 'received']

// Even while the order overall is open, a waybill locks the moment
// ITS OWN status flips to "received" — only the still-pending ones
// can be edited or removed.
const isRowEditable = (t) => t.status === 'pending'

const PACKING_LIST_SERVICE_TYPE = 'sea_freight'

export default function BatchDetail() {
  const { id } = useParams()
  const [batch, setBatch] = useState(null)
  const [tracking, setTracking] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [rowError, setRowError] = useState('')

  const [addingNew, setAddingNew] = useState(false)
  const [newWaybill, setNewWaybill] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  async function load() {
    const [{ data: b }, { data: t }, { data: pl }] = await Promise.all([
      supabase.from('batches').select('*').eq('id', id).single(),
      supabase.from('tracking_numbers').select('*').eq('batch_id', id).order('created_at'),
      supabase
        .from('packing_lists')
        .select('*, packing_list_items(*)')
        .eq('batch_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    setBatch(b)
    setTracking(t || [])
    setItems(pl?.packing_list_items || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [id])

  const orderEditable = batch && EDITABLE_STATUSES.includes(batch.status)
  const showPackingList = batch?.service_type === PACKING_LIST_SERVICE_TYPE

  function startEdit(t) {
    setEditingId(t.id)
    setEditValue(t.waybill_number)
    setRowError('')
  }

  async function saveEdit(trackingId) {
    if (!editValue.trim()) {
      setRowError('Waybill number can\u2019t be empty.')
      return
    }
    setSavingId(trackingId)
    const { error } = await supabase
      .from('tracking_numbers')
      .update({ waybill_number: editValue.trim() })
      .eq('id', trackingId)
    setSavingId(null)
    if (error) {
      setRowError(error.message)
      return
    }
    setEditingId(null)
    await load()
  }

  async function handleAddWaybill(e) {
    e.preventDefault()
    setAddError('')
    if (!newWaybill.trim()) {
      setAddError('Enter a waybill number.')
      return
    }
    setAdding(true)
    const { error } = await supabase
      .from('tracking_numbers')
      .insert({ batch_id: id, waybill_number: newWaybill.trim() })
    setAdding(false)
    if (error) {
      setAddError(error.message)
      return
    }
    setNewWaybill('')
    setAddingNew(false)
    await load()
  }

  if (loading) {
    return (
      <AppShell title="Order">
        <p className="text-sm text-steel">Loading…</p>
      </AppShell>
    )
  }

  if (!batch) {
    return (
      <AppShell title="Order not found">
        <p className="text-sm text-steel">This order doesn&rsquo;t exist or you don&rsquo;t have access to it.</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="font-mono text-xs text-steel uppercase tracking-wide mb-1">Order</div>
          <h1 className="font-display text-2xl font-semibold text-ink font-mono">{batch.batch_code}</h1>
          <div className="text-sm text-steel mt-1 flex gap-2">
            {batch.service_type && <span>{formatServiceType(batch.service_type)}</span>}
            {batch.route && <span>· {formatRoute(batch.route)}</span>}
          </div>
        </div>
        <StatusStamp status={batch.status} />
      </div>

      <h2 className="font-display text-lg font-semibold text-ink mb-3">Tracking numbers</h2>

      {!orderEditable && (
        <p className="text-xs text-steel mb-3">
          This order has shipped, so it&rsquo;s locked on your end — reach out to us if something needs to change.
        </p>
      )}

      <div className="space-y-2 mb-4">
        {tracking.map((t) => {
          const editable = orderEditable && isRowEditable(t)
          const isEditingThis = editingId === t.id

          return (
            <div key={t.id} className="manifest-card p-4">
              {isEditingThis ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 rounded-md border border-steel-line bg-white px-3 py-1.5 text-sm font-mono text-ink focus:border-amber outline-none"
                  />
                  <button
                    onClick={() => saveEdit(t.id)}
                    disabled={savingId === t.id}
                    className="text-xs font-medium text-white bg-cargo rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-steel hover:text-ink">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-sm text-ink">{t.waybill_number}</div>
                    <div className="text-xs text-steel mt-0.5">
                      {t.quantity
                        ? `Qty ${t.quantity}`
                        : t.status === 'pending'
                          ? 'Awaiting confirmation'
                          : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {editable ? (
                      <button
                        onClick={() => startEdit(t)}
                        className="text-xs font-medium text-amber hover:text-ink"
                      >
                        Edit
                      </button>
                    ) : orderEditable ? (
                      <span className="text-xs text-steel">Received — locked</span>
                    ) : null}
                    <StatusStamp status={t.status} />
                  </div>
                </div>
              )}
              {isEditingThis && rowError && <p className="text-xs text-alert mt-2">{rowError}</p>}
            </div>
          )
        })}
      </div>

      {orderEditable && (
        <div className="mb-8">
          {addingNew ? (
            <form onSubmit={handleAddWaybill} className="manifest-card p-4 flex items-end gap-2">
              <label className="flex-1">
                <span className="block text-xs font-medium text-ink mb-1">New waybill number</span>
                <input
                  autoFocus
                  value={newWaybill}
                  onChange={(e) => setNewWaybill(e.target.value)}
                  className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm font-mono text-ink focus:border-amber outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={adding}
                className="text-sm font-medium text-white bg-ink rounded-md px-4 py-2 hover:bg-ink-soft disabled:opacity-50"
              >
                {adding ? 'Adding…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingNew(false)
                  setAddError('')
                }}
                className="text-sm text-steel hover:text-ink"
              >
                Cancel
              </button>
              {addError && <p className="text-xs text-alert">{addError}</p>}
            </form>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="text-sm font-medium text-ink border border-steel-line rounded-md px-4 py-2 hover:border-amber transition-colors"
            >
              + Add another waybill
            </button>
          )}
        </div>
      )}

      {showPackingList && (
        <>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-lg font-semibold text-ink">Packing list</h2>
            {items.length > 0 && (
              <button
                onClick={() => downloadPackingListCsv(batch.batch_code, items)}
                className="text-sm font-medium text-amber hover:text-ink"
              >
                Download CSV
              </button>
            )}
          </div>
          <p className="text-xs text-steel mb-3">Note: price excludes customs clearing.</p>

          {items.length === 0 ? (
            <p className="text-sm text-steel">Not added yet. It&rsquo;ll appear here once our team fills it in.</p>
          ) : (
            <div className="manifest-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-steel-line text-left text-xs uppercase tracking-wide text-steel">
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Weight (kg)</th>
                    <th className="px-4 py-3 font-medium">CBM</th>
                    <th className="px-4 py-3 font-medium">Price per CBM</th>
                    <th className="px-4 py-3 font-medium">Amount ($)</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-steel-line last:border-0">
                      <td className="px-4 py-3 text-ink">{item.quantity}</td>
                      <td className="px-4 py-3 text-ink">{item.weight ?? '—'}</td>
                      <td className="px-4 py-3 text-ink">{item.cbm ?? '—'}</td>
                      <td className="px-4 py-3 text-ink">{item.price_per_cbm ?? '—'}</td>
                      <td className="px-4 py-3 text-ink">{item.amount ?? '—'}</td>
                      <td className="px-4 py-3 text-steel">{item.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
