import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import StatusStamp from '../components/StatusStamp'
import { supabase } from '../lib/supabaseClient'
import { downloadPackingListCsv } from '../lib/exportCsv'
import { formatServiceType, formatRoute } from '../lib/labels'

// An order stays editable by the customer up through "received" —
// once it's in_transit (shipped) or further along, only admin can
// change it.
const EDITABLE_STATUSES = ['submitted', 'received']

// Packing lists only apply to sea freight — hidden entirely for
// air freight / express on the customer side. Admin still manages
// packing lists regardless of service type.
const PACKING_LIST_SERVICE_TYPE = 'sea_freight'

const emptyWaybill = () => ({ id: null, waybill_number: '' })

export default function BatchDetail() {
  const { id } = useParams()
  const [batch, setBatch] = useState(null)
  const [tracking, setTracking] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [isEditing, setIsEditing] = useState(false)
  const [rows, setRows] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

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

  const editable = batch && EDITABLE_STATUSES.includes(batch.status)
  const showPackingList = batch?.service_type === PACKING_LIST_SERVICE_TYPE

  function startEditing() {
    setRows(
      tracking.map((t) => ({
        id: t.id,
        waybill_number: t.waybill_number,
      }))
    )
    setSaveError('')
    setIsEditing(true)
  }

  function updateRow(index, field, value) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function addRow() {
    setRows((rs) => [...rs, emptyWaybill()])
  }

  function removeRow(index) {
    setRows((rs) => rs.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setSaveError('')
    const validRows = rows.filter((r) => r.waybill_number.trim())
    if (validRows.length === 0) {
      setSaveError('An order needs at least one waybill. Remove the whole order instead if you no longer need it.')
      return
    }

    setSaving(true)
    try {
      const existingIds = new Set(tracking.map((t) => t.id))
      const keptIds = new Set(validRows.filter((r) => r.id).map((r) => r.id))
      const removedIds = [...existingIds].filter((tid) => !keptIds.has(tid))

      const updates = validRows
        .filter((r) => r.id)
        .map((r) =>
          supabase
            .from('tracking_numbers')
            .update({
              waybill_number: r.waybill_number.trim(),
            })
            .eq('id', r.id)
        )

      const newRows = validRows
        .filter((r) => !r.id)
        .map((r) => ({
          batch_id: id,
          waybill_number: r.waybill_number.trim(),
        }))

      const ops = [...updates]
      if (newRows.length > 0) ops.push(supabase.from('tracking_numbers').insert(newRows))
      if (removedIds.length > 0) ops.push(supabase.from('tracking_numbers').delete().in('id', removedIds))

      const results = await Promise.all(ops)
      const failed = results.find((r) => r.error)
      if (failed) throw failed.error

      setIsEditing(false)
      await load()
    } catch (err) {
      setSaveError(err.message || 'Could not save these changes. Try again.')
    } finally {
      setSaving(false)
    }
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

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold text-ink">Tracking numbers</h2>
        {editable && !isEditing && (
          <button onClick={startEditing} className="text-sm font-medium text-amber hover:text-ink">
            Edit
          </button>
        )}
      </div>

      {!editable && (
        <p className="text-xs text-steel mb-3">
          This order has shipped, so it&rsquo;s locked on your end — reach out to us if something needs to change.
        </p>
      )}

      {isEditing ? (
        <div className="mb-8">
          <div className="space-y-4">
            {rows.map((w, i) => (
              <div key={w.id ?? `new-${i}`} className="manifest-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-wide text-steel">
                    {w.id ? `Waybill ${i + 1}` : `Waybill ${i + 1} (new)`}
                  </span>
                  <button type="button" onClick={() => removeRow(i)} className="text-xs text-alert hover:underline">
                    Remove
                  </button>
                </div>
                <label className="block">
                  <span className="block text-sm font-medium text-ink mb-1.5">Waybill number</span>
                  <input
                    value={w.waybill_number}
                    onChange={(e) => updateRow(i, 'waybill_number', e.target.value)}
                    className="w-full rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm font-mono text-ink focus:border-amber outline-none"
                  />
                </label>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="mt-4 text-sm font-medium text-ink border border-steel-line rounded-md px-4 py-2 hover:border-amber transition-colors"
          >
            + Add another waybill
          </button>

          {saveError && <p className="text-sm text-alert mt-4">{saveError}</p>}

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-cargo text-white font-medium text-sm px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              disabled={saving}
              className="text-sm font-medium text-steel hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 mb-8">
          {tracking.map((t) => (
            <div key={t.id} className="manifest-card p-4 flex items-center justify-between">
              <div>
                <div className="font-mono text-sm text-ink">{t.waybill_number}</div>
                <div className="text-xs text-steel mt-0.5">
                  {t.quantity ? `Qty ${t.quantity}` : 'Awaiting confirmation from our team'}
                </div>
              </div>
              <StatusStamp status={t.status} />
            </div>
          ))}
        </div>
      )}

      {showPackingList && (
        <>
          <div className="flex items-center justify-between mb-3">
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
