import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const emptyWaybill = () => ({ waybill_number: '', courier_name: '', quantity: 1 })

function generateBatchCode() {
  const year = new Date().getFullYear()
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `BCH-${year}-${rand}`
}

export default function NewBatch() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [serviceType, setServiceType] = useState('sea_shipping')
  const [route, setRoute] = useState('china_nigeria')
  const [waybills, setWaybills] = useState([emptyWaybill()])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateWaybill(index, field, value) {
    setWaybills((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function addWaybill() {
    setWaybills((rows) => [...rows, emptyWaybill()])
  }

  function removeWaybill(index) {
    setWaybills((rows) => rows.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const validRows = waybills.filter((w) => w.waybill_number.trim())
    if (validRows.length === 0) {
      setError('Add at least one waybill number.')
      return
    }

    setLoading(true)
    try {
      // This batch code is what keeps this upload from ever mixing
      // with a previous one — every batch, however many waybills it
      // holds, gets exactly one code.
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .insert({
          batch_code: generateBatchCode(),
          customer_id: profile.id,
          created_by: profile.id,
          service_type: serviceType,
          route,
        })
        .select()
        .single()
      if (batchError) throw batchError

      const rows = validRows.map((w) => ({
        batch_id: batch.id,
        waybill_number: w.waybill_number.trim(),
        courier_name: w.courier_name.trim() || 'Not specified',
        quantity: Number(w.quantity) || 1,
      }))
      const { error: trackingError } = await supabase.from('tracking_numbers').insert(rows)
      if (trackingError) throw trackingError

      navigate(`/batches/${batch.id}`)
    } catch (err) {
      setError(err.message || 'Could not submit this batch. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell title="Upload tracking numbers">
      <p className="text-sm text-steel mb-6 max-w-xl">
        Add each waybill as a separate entry so it can be tracked individually. Everything you add here becomes
        one batch, so future uploads never get mixed in with this one.
      </p>

      <form onSubmit={handleSubmit} className="max-w-xl">
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <label className="block">
            <span className="block text-sm font-medium text-ink mb-1.5">Service type</span>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-amber outline-none"
            >
              <option value="sea_shipping">Sea Shipping</option>
              <option value="air_cargo">Air Cargo / Express</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink mb-1.5">Route</span>
            <select
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="w-full rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-amber outline-none"
            >
              <option value="china_nigeria">China \u2192 Nigeria</option>
              <option value="dubai_nigeria">Dubai \u2192 Nigeria</option>
            </select>
          </label>
        </div>

        <div className="space-y-4">
          {waybills.map((w, i) => (
            <div key={i} className="manifest-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-wide text-steel">Waybill {i + 1}</span>
                {waybills.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeWaybill(i)}
                    className="text-xs text-alert hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>

              <label className="block mb-3">
                <span className="block text-sm font-medium text-ink mb-1.5">Waybill number</span>
                <input
                  required
                  value={w.waybill_number}
                  onChange={(e) => updateWaybill(i, 'waybill_number', e.target.value)}
                  className="w-full rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm font-mono text-ink focus:border-amber outline-none"
                  placeholder="e.g. 71009618..."
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-sm font-medium text-ink mb-1.5">Courier name</span>
                  <input
                    value={w.courier_name}
                    onChange={(e) => updateWaybill(i, 'courier_name', e.target.value)}
                    className="w-full rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-amber outline-none"
                    placeholder="e.g. GZ Sea Cargo"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-ink mb-1.5">Quantity</span>
                  <input
                    type="number"
                    min={1}
                    value={w.quantity}
                    onChange={(e) => updateWaybill(i, 'quantity', e.target.value)}
                    className="w-full rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-amber outline-none"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addWaybill}
          className="mt-4 text-sm font-medium text-ink border border-steel-line rounded-md px-4 py-2 hover:border-amber transition-colors"
        >
          + Add another waybill
        </button>

        {error && <p className="text-sm text-alert mt-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-md bg-cargo text-white font-medium text-sm py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Submitting…' : 'Submit batch'}
        </button>
      </form>
    </AppShell>
  )
}
