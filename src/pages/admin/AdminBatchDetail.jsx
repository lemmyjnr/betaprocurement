import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import StatusStamp from '../../components/StatusStamp'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

const BATCH_STATUSES = ['submitted', 'received', 'in_transit', 'arrived_port', 'clearing', 'delivered']

const emptyItem = () => ({ quantity: 1, weight: '', cbm: '', price_per_cbm: '', amount: '', notes: '' })

export default function AdminBatchDetail() {
  const { id } = useParams()
  const { profile, session } = useAuth()
  const uploaderId = profile?.id || session?.user?.id
  const [batch, setBatch] = useState(null)
  const [tracking, setTracking] = useState([])
  const [packingList, setPackingList] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newWaybill, setNewWaybill] = useState({ waybill_number: '', courier_name: '', quantity: 1 })
  const [newItem, setNewItem] = useState(emptyItem())
  const [savingItem, setSavingItem] = useState(false)
  const [message, setMessage] = useState('')

  async function loadAll() {
    const [{ data: b }, { data: t }, { data: pl }] = await Promise.all([
      supabase.from('batches').select('*, profiles!batches_customer_id_fkey(full_name, phone)').eq('id', id).single(),
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
    setPackingList(pl)
    setItems(pl?.packing_list_items || [])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [id])

  async function handleStatusChange(status) {
    await supabase.from('batches').update({ status }).eq('id', id)
    setBatch((b) => ({ ...b, status }))
  }

  async function handleTrackingFieldChange(trackingId, field, value) {
    setTracking((rows) => rows.map((r) => (r.id === trackingId ? { ...r, [field]: value } : r)))
  }

  async function handleTrackingFieldSave(trackingId, field, value) {
    await supabase
      .from('tracking_numbers')
      .update({ [field]: field === 'quantity' ? Number(value) || null : value.trim() || null })
      .eq('id', trackingId)
  }

  async function handleTrackingStatusChange(trackingId, status) {
    await supabase.from('tracking_numbers').update({ status }).eq('id', trackingId)
    setTracking((rows) => rows.map((r) => (r.id === trackingId ? { ...r, status } : r)))
  }

  async function handleAddWaybill(e) {
    e.preventDefault()
    if (!newWaybill.waybill_number.trim()) return
    const { error } = await supabase.from('tracking_numbers').insert({
      batch_id: id,
      waybill_number: newWaybill.waybill_number.trim(),
      courier_name: newWaybill.courier_name.trim() || 'Not specified',
      quantity: Number(newWaybill.quantity) || 1,
    })
    if (!error) {
      setNewWaybill({ waybill_number: '', courier_name: '', quantity: 1 })
      loadAll()
    }
  }

  function updateNewItemField(field, value) {
    setNewItem((it) => {
      const next = { ...it, [field]: value }
      // Convenience: auto-fill Amount from CBM × Price/CBM whenever
      // either changes, admin can still type over it afterward if
      // the real amount differs.
      if (field === 'cbm' || field === 'price_per_cbm') {
        const cbm = parseFloat(field === 'cbm' ? value : next.cbm)
        const price = parseFloat(field === 'price_per_cbm' ? value : next.price_per_cbm)
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
      // Every batch's packing list is one header row that the items
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
    await supabase.from('packing_list_items').delete().eq('id', itemId)
    setItems((rows) => rows.filter((r) => r.id !== itemId))
  }

  if (loading) {
    return (
      <AppShell title="Batch">
        <p className="text-sm text-steel">Loading…</p>
      </AppShell>
    )
  }

  if (!batch) {
    return (
      <AppShell title="Not found">
        <p className="text-sm text-steel">No batch with this ID.</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-mono text-xs text-steel uppercase tracking-wide mb-1">Batch</div>
          <h1 className="font-display text-2xl font-semibold text-ink font-mono">{batch.batch_code}</h1>
          <div className="text-sm text-steel mt-1">
            {batch.profiles?.full_name} · {batch.profiles?.phone}
          </div>
          <div className="text-sm text-steel mt-1 flex gap-2">
            {batch.service_type && <span className="capitalize">{batch.service_type.replace('_', ' ')}</span>}
            {batch.route && <span>· {batch.route.replace('_', ' - ')}</span>}
          </div>
        </div>
        <select
          value={batch.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-md border border-steel-line bg-white px-3 py-1.5 text-sm text-ink"
        >
          {BATCH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <h2 className="font-display text-lg font-semibold text-ink mt-8 mb-3">Tracking numbers</h2>
      <div className="space-y-2 mb-4">
        {tracking.map((t) => (
          <div key={t.id} className="manifest-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-sm text-ink">{t.waybill_number}</div>
              <select
                value={t.status}
                onChange={(e) => handleTrackingStatusChange(t.id, e.target.value)}
                className="rounded-md border border-steel-line bg-white px-2.5 py-1 text-xs text-ink"
              >
                {['pending', 'received', 'shipped', 'arrived_port', 'delivered'].map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-steel mb-1">Courier</span>
                <input
                  value={t.courier_name || ''}
                  onChange={(e) => handleTrackingFieldChange(t.id, 'courier_name', e.target.value)}
                  onBlur={(e) => handleTrackingFieldSave(t.id, 'courier_name', e.target.value)}
                  placeholder="Not yet set"
                  className="w-full rounded-md border border-steel-line bg-white px-3 py-1.5 text-sm text-ink focus:border-amber outline-none"
                />
              </label>
              <label className="block">
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
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleAddWaybill} className="manifest-card p-4 flex flex-wrap gap-3 items-end mb-8">
        <label className="flex-1 min-w-[140px]">
          <span className="block text-xs font-medium text-ink mb-1">Waybill number</span>
          <input
            value={newWaybill.waybill_number}
            onChange={(e) => setNewWaybill((w) => ({ ...w, waybill_number: e.target.value }))}
            className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="flex-1 min-w-[140px]">
          <span className="block text-xs font-medium text-ink mb-1">Courier</span>
          <input
            value={newWaybill.courier_name}
            onChange={(e) => setNewWaybill((w) => ({ ...w, courier_name: e.target.value }))}
            className="w-full rounded-md border border-steel-line bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="w-20">
          <span className="block text-xs font-medium text-ink mb-1">Qty</span>
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
      </form>

      <h2 className="font-display text-lg font-semibold text-ink mb-3">Packing list</h2>

      {items.length > 0 && (
        <div className="manifest-card overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-steel-line text-left text-xs uppercase tracking-wide text-steel">
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Weight (kg)</th>
                <th className="px-4 py-3 font-medium">CBM</th>
                <th className="px-4 py-3 font-medium">Price/CBM</th>
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

      <form onSubmit={handleAddItem} className="manifest-card p-4 flex flex-wrap gap-3 items-end">
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
        <label className="w-28">
          <span className="block text-xs font-medium text-ink mb-1">Price/CBM</span>
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
      </form>
      {message && <p className="text-sm text-alert mt-2">{message}</p>}
    </AppShell>
  )
}
