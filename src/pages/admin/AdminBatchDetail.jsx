import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import StatusStamp from '../../components/StatusStamp'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { formatServiceType, formatRoute } from '../../lib/labels'

const BATCH_STATUSES = ['submitted', 'received', 'in_transit', 'arrived_port', 'clearing', 'delivered']
const BATCH_STATUS_LABELS = {
  submitted: 'Submitted',
  received: 'Received',
  in_transit: 'In transit',
  arrived_port: 'Arrived at port',
  clearing: 'Clearing',
  delivered: 'Delivered',
}

// Tracking-number status is deliberately just these two — the fuller
// lifecycle lives at the order level (the dropdown above).
const TRACKING_STATUSES = ['pending', 'received']
const TRACKING_STATUS_LABELS = { pending: 'Pending', received: 'Received' }

const emptyItem = () => ({
  quantity: 1,
  weight: '',
  cbm: '',
  price_per_cbm: '',
  amount: '',
  notes: '',
  length: '',
  width: '',
  height: '',
})

export default function AdminBatchDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, session } = useAuth()
  const uploaderId = profile?.id || session?.user?.id
  const [batch, setBatch] = useState(null)
  const [tracking, setTracking] = useState([])
  const [packingList, setPackingList] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newWaybill, setNewWaybill] = useState({ waybill_number: '', quantity: 1 })
  const [newItem, setNewItem] = useState(emptyItem())
  const [useDimensions, setUseDimensions] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [message, setMessage] = useState('')
  const [deletingOrder, setDeletingOrder] = useState(false)

  async function handleDeleteOrder() {
    const confirmed = confirm(
      `Permanently delete order ${batch?.batch_code}? This removes every tracking number and packing list on it. This can\u2019t be undone.`
    )
    if (!confirmed) return
    setDeletingOrder(true)
    // .select() here matters: without it, a delete that Row Level
    // Security silently blocks (0 rows matched) comes back with no
    // error at all, and this would navigate away as if it worked
    // while the order is still sitting there untouched.
    const { data, error } = await supabase.from('batches').delete().eq('id', id).select('id')
    setDeletingOrder(false)
    if (error) {
      setMessage(error.message)
      return
    }
    if (!data || data.length === 0) {
      setMessage("This didn't delete — you may not have permission, or it was already removed. Refresh and try again.")
      return
    }
    navigate('/admin/batches')
  }

  async function loadAll() {
    const [{ data: b }, { data: t }, { data: pl }] = await Promise.all([
      supabase.from('batches').select('*, profiles!batches_customer_id_fkey(full_name, phone)').eq('id', id).single(),
      supabase.from('tracking_numbers').select('*').eq('batch_id', id).order('created_at').order('id'),
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
    setPackingList(pl)
    setItems(pl?.packing_list_items || [])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [id])

  async function handleStatusChange(status) {
    const { error } = await supabase.from('batches').update({ status }).eq('id', id)
    if (error) {
      setMessage(error.message)
      return
    }
    setBatch((b) => ({ ...b, status }))
  }

  async function handleTrackingFieldChange(trackingId, field, value) {
    setTracking((rows) => rows.map((r) => (r.id === trackingId ? { ...r, [field]: value } : r)))
  }

  async function handleTrackingFieldSave(trackingId, field, value) {
    const { error } = await supabase
      .from('tracking_numbers')
      .update({ [field]: field === 'quantity' ? Number(value) || null : value })
      .eq('id', trackingId)
    if (error) setMessage(error.message)
  }

  async function handleTrackingStatusChange(trackingId, status) {
    const { error } = await supabase.from('tracking_numbers').update({ status }).eq('id', trackingId)
    if (error) {
      setMessage(error.message)
      return
    }
    setTracking((rows) => rows.map((r) => (r.id === trackingId ? { ...r, status } : r)))
  }

  async function handleRemoveTracking(trackingId) {
    // .select() matters here the same way it does for deleting an
    // order: without it, a delete that RLS silently blocks (0 rows
    // matched) reports no error, and the row would disappear from
    // the screen even though it's still sitting in the database.
    const { data, error } = await supabase.from('tracking_numbers').delete().eq('id', trackingId).select('id')
    if (error) {
      setMessage(error.message)
      return
    }
    if (!data || data.length === 0) {
      setMessage("That waybill didn't actually delete — refresh and try again.")
      return
    }
    setTracking((rows) => rows.filter((r) => r.id !== trackingId))
  }

  async function handleAddWaybill(e) {
    e.preventDefault()
    const numbers = [
      ...new Set(newWaybill.waybill_number.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)),
    ]
    if (numbers.length === 0) return
    const qty = Number(newWaybill.quantity) || 1
    const { error } = await supabase
      .from('tracking_numbers')
      .insert(numbers.map((waybill_number) => ({ batch_id: id, waybill_number, quantity: qty })))
    if (!error) {
      setNewWaybill({ waybill_number: '', quantity: 1 })
      loadAll()
    }
  }

  function updateNewItemField(field, value) {
    setNewItem((it) => {
      const next = { ...it, [field]: value }

      // If dimensions are being used, CBM is derived from them
      // automatically: (L × W × H in cm) ÷ 1,000,000.
      if (useDimensions && ['length', 'width', 'height'].includes(field)) {
        const l = parseFloat(field === 'length' ? value : next.length)
        const w = parseFloat(field === 'width' ? value : next.width)
        const h = parseFloat(field === 'height' ? value : next.height)
        if (!isNaN(l) && !isNaN(w) && !isNaN(h)) {
          next.cbm = String(Math.round(((l * w * h) / 1000000) * 10000) / 10000)
        }
      }

      // Convenience: auto-fill Amount from CBM × Price per CBM
      // whenever either changes — admin can still type over it.
      if (['cbm', 'price_per_cbm', 'length', 'width', 'height'].includes(field)) {
        const cbm = parseFloat(field === 'cbm' ? value : next.cbm)
        const price = parseFloat(next.price_per_cbm)
        if (!isNaN(cbm) && !isNaN(price)) next.amount = String(Math.round(cbm * price * 100) / 100)
      }
      return next
    })
  }

  async function handleAddItem(e) {
    e.preventDefault()
    if (!uploaderId) {
      setMessage('Still loading your account — give it a second and try again.')
      return
    }
    setSavingItem(true)
    setMessage('')
    try {
      // Every order's packing list is one header row that the items
      // hang off of. Create it the first time an item gets added.
      let listId = packingList?.id
      if (!listId) {
        const { data: created, error: createError } = await supabase
          .from('packing_lists')
          .insert({ batch_id: id, uploaded_by: uploaderId })
          .select()
          .single()
        if (createError) throw createError
        listId = created.id
      }

      const { error: itemError } = await supabase.from('packing_list_items').insert({
        packing_list_id: listId,
        quantity: Number(newItem.quantity) || 1,
        weight: newItem.weight ? Number(newItem.weight) : null,
        cbm: newItem.cbm ? Number(newItem.cbm) : null,
        price_per_cbm: newItem.price_per_cbm ? Number(newItem.price_per_cbm) : null,
        amount: newItem.amount ? Number(newItem.amount) : null,
        notes: newItem.notes.trim() || null,
      })
      if (itemError) throw itemError

      setNewItem(emptyItem())
      loadAll()
    } catch (err) {
      setMessage(err.message || 'Could not add this item.')
    } finally {
      setSavingItem(false)
    }
  }

  async function handleRemoveItem(itemId) {
    const { data, error } = await supabase.from('packing_list_items').delete().eq('id', itemId).select('id')
    if (error) {
      setMessage(error.message)
      return
    }
    if (!data || data.length === 0) {
      setMessage("That line item didn't actually delete — refresh and try again.")
      return
    }
    setItems((rows) => rows.filter((r) => r.id !== itemId))
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
      <AppShell title="Not found">
        <p className="text-sm text-steel">No order with this ID.</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-mono text-xs text-steel uppercase tracking-wide mb-1">Order</div>
          <h1 className="font-display text-2xl font-semibold text-ink font-mono">{batch.batch_code}</h1>
          <div className="text-sm text-steel mt-1">
            {batch.profiles?.full_name} · {batch.profiles?.phone}
          </div>
          <div className="text-sm text-steel mt-1 flex gap-2">
            {batch.service_type && <span>{formatServiceType(batch.service_type)}</span>}
            {batch.route && <span>· {formatRoute(batch.route)}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <select
            value={batch.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-md border border-steel-line bg-white px-3 py-1.5 text-sm text-ink"
          >
            {BATCH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BATCH_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            onClick={handleDeleteOrder}
            disabled={deletingOrder}
            className="text-xs text-alert hover:underline disabled:opacity-50"
          >
            {deletingOrder ? 'Deleting…' : 'Delete order'}
          </button>
        </div>
      </div>

      <h2 className="font-display text-lg font-semibold text-ink mt-8 mb-3">Tracking numbers</h2>
      <div className="space-y-2 mb-4">
        {tracking.map((t) => (
          <div key={t.id} className="manifest-card p-4">
            <div className="flex items-center justify-between mb-3 gap-3">
              <input
                value={t.waybill_number}
                onChange={(e) => handleTrackingFieldChange(t.id, 'waybill_number', e.target.value)}
                onBlur={(e) => handleTrackingFieldSave(t.id, 'waybill_number', e.target.value)}
                className="flex-1 rounded-md border border-steel-line bg-white px-3 py-1.5 text-sm font-mono text-ink focus:border-amber outline-none"
              />
              <select
                value={t.status}
                onChange={(e) => handleTrackingStatusChange(t.id, e.target.value)}
                className="rounded-md border border-steel-line bg-white px-2.5 py-1 text-xs text-ink"
              >
                {TRACKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TRACKING_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <label className="block max-w-[140px]">
              <span className="block text-xs font-medium text-steel mb-1">Quantity</span>
              <input
                type="number"
                min={1}
                value={t.quantity ?? ''}
                onChange={(e) => handleTrackingFieldChange(t.id, 'quantity', e.target.value)}
                onBlur={(e) => handleTrackingFieldSave(t.id, 'quantity', e.target.value)}
                placeholder="Not yet set"
                className="w-full rounded-md border border-steel-line bg-white px-3 py-1.5 text-sm text-ink focus:border-amber outline-none"
              />
            </label>
            <button
              onClick={() => handleRemoveTracking(t.id)}
              className="text-xs text-alert hover:underline mt-3"
            >
              Remove waybill
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAddWaybill} className="manifest-card p-4 mb-8">
        <label className="block mb-3">
          <span className="block text-xs font-medium text-ink mb-1">
            Waybill number(s) — one per line, or separated by commas
          </span>
          <textarea
            rows={3}
            value={newWaybill.waybill_number}
            onChange={(e) => setNewWaybill((w) => ({ ...w, waybill_number: e.target.value }))}
            placeholder={'71009618\n71009619'}
            className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm font-mono"
          />
        </label>
        <div className="flex items-end gap-3">
          <label className="w-24">
            <span className="block text-xs font-medium text-ink mb-1">Qty each</span>
            <input
              type="number"
              min={1}
              value={newWaybill.quantity}
              onChange={(e) => setNewWaybill((w) => ({ ...w, quantity: e.target.value }))}
              className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm"
            />
          </label>
          <button type="submit" className="text-sm font-medium text-white bg-ink rounded-md px-4 py-2 hover:bg-ink-soft">
            + Add
          </button>
        </div>
      </form>

      <h2 className="font-display text-lg font-semibold text-ink mb-1">Packing list</h2>
      <p className="text-xs text-steel mb-3">Note: price excludes customs clearing.</p>

      {items.length > 0 && (
        <div className="manifest-card overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-steel-line text-left text-xs uppercase tracking-wide text-steel">
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Weight (kg)</th>
                <th className="px-4 py-3 font-medium">CBM</th>
                <th className="px-4 py-3 font-medium">Price per CBM</th>
                <th className="px-4 py-3 font-medium">Amount ($)</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3"></th>
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
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-xs text-alert hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleAddItem} className="manifest-card p-4">
        <button
          type="button"
          onClick={() => setUseDimensions((u) => !u)}
          className="text-xs font-medium text-amber hover:text-ink mb-3"
        >
          {useDimensions ? 'Enter CBM directly instead' : 'Calculate CBM from dimensions instead'}
        </button>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="w-20">
            <span className="block text-xs font-medium text-ink mb-1">Qty</span>
            <input
              type="number"
              min={1}
              value={newItem.quantity}
              onChange={(e) => updateNewItemField('quantity', e.target.value)}
              className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="w-28">
            <span className="block text-xs font-medium text-ink mb-1">Weight (kg)</span>
            <input
              type="number"
              step="0.01"
              value={newItem.weight}
              onChange={(e) => updateNewItemField('weight', e.target.value)}
              className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm"
            />
          </label>

          {useDimensions ? (
            <>
              <label className="w-24">
                <span className="block text-xs font-medium text-ink mb-1">Length (cm)</span>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.length}
                  onChange={(e) => updateNewItemField('length', e.target.value)}
                  className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="w-24">
                <span className="block text-xs font-medium text-ink mb-1">Width (cm)</span>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.width}
                  onChange={(e) => updateNewItemField('width', e.target.value)}
                  className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="w-24">
                <span className="block text-xs font-medium text-ink mb-1">Height (cm)</span>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.height}
                  onChange={(e) => updateNewItemField('height', e.target.value)}
                  className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="w-24">
                <span className="block text-xs font-medium text-ink mb-1">CBM (auto)</span>
                <input
                  readOnly
                  value={newItem.cbm}
                  className="w-full rounded-md border border-steel-line bg-paper-dim px-3 py-2 text-sm text-steel"
                />
              </label>
            </>
          ) : (
            <label className="w-24">
              <span className="block text-xs font-medium text-ink mb-1">CBM</span>
              <input
                type="number"
                step="0.01"
                value={newItem.cbm}
                onChange={(e) => updateNewItemField('cbm', e.target.value)}
                className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm"
              />
            </label>
          )}

          <label className="w-28">
            <span className="block text-xs font-medium text-ink mb-1">Price per CBM</span>
            <input
              type="number"
              step="0.01"
              value={newItem.price_per_cbm}
              onChange={(e) => updateNewItemField('price_per_cbm', e.target.value)}
              className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="w-28">
            <span className="block text-xs font-medium text-ink mb-1">Amount ($)</span>
            <input
              type="number"
              step="0.01"
              value={newItem.amount}
              onChange={(e) => updateNewItemField('amount', e.target.value)}
              className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex-1 min-w-[160px]">
            <span className="block text-xs font-medium text-ink mb-1">Notes</span>
            <input
              value={newItem.notes}
              onChange={(e) => updateNewItemField('notes', e.target.value)}
              className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </label>
          <button
            type="submit"
            disabled={savingItem}
            className="text-sm font-medium text-white bg-cargo rounded-md px-4 py-2 hover:opacity-90 disabled:opacity-50"
          >
            {savingItem ? 'Adding…' : '+ Add item'}
          </button>
        </div>
      </form>
      {message && <p className="text-sm text-alert mt-2">{message}</p>}
    </AppShell>
  )
}
