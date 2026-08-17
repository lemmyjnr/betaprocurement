import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { SERVICE_TYPES, SERVICE_TYPE_LABELS, ROUTES, ROUTE_LABELS } from '../../lib/labels'

const emptyWaybill = () => ({ waybill_number: '' })

function generateBatchCode() {
  const year = new Date().getFullYear()
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `BCH-${year}-${rand}`
}

export default function AdminNewBatch() {
  const { customerId } = useParams()
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const uploaderId = profile?.id || session?.user?.id

  const [customer, setCustomer] = useState(null)
  const [serviceType, setServiceType] = useState('sea_freight')
  const [route, setRoute] = useState('china_nigeria')
  const [waybills, setWaybills] = useState([emptyWaybill()])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', customerId)
      .single()
      .then(({ data }) => setCustomer(data))
  }, [customerId])

  function updateWaybill(index, value) {
    setWaybills((rows) => rows.map((r, i) => (i === index ? { waybill_number: value } : r)))
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
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .insert({
          batch_code: generateBatchCode(),
          customer_id: customerId,
          created_by: uploaderId,
          service_type: serviceType,
          route,
        })
        .select()
        .single()
      if (batchError) throw batchError

      const rows = validRows.map((w) => ({
        batch_id: batch.id,
        waybill_number: w.waybill_number.trim(),
      }))
      const { error: trackingError } = await supabase.from('tracking_numbers').insert(rows)
      if (trackingError) throw trackingError

      navigate(`/admin/batches/${batch.id}`)
    } catch (err) {
      setError(err.message || 'Could not create this order. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell title="New order">
      <p className="text-sm text-steel mb-6 max-w-xl">
        For {customer?.full_name || 'this customer'} {customer?.phone && `(${customer.phone})`} — this creates a
        brand-new order on their behalf, same as if they&rsquo;d submitted it themselves.
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
              {SERVICE_TYPES.map((st) => (
                <option key={st} value={st}>
                  {SERVICE_TYPE_LABELS[st]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink mb-1.5">Route</span>
            <select
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="w-full rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-amber outline-none"
            >
              {ROUTES.map((r) => (
                <option key={r} value={r}>
                  {ROUTE_LABELS[r]}
                </option>
              ))}
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
              <label className="block">
                <span className="block text-sm font-medium text-ink mb-1.5">Waybill number</span>
                <input
                  required
                  value={w.waybill_number}
                  onChange={(e) => updateWaybill(i, e.target.value)}
                  className="w-full rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm font-mono text-ink focus:border-amber outline-none"
                />
              </label>
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
          {loading ? 'Creating…' : 'Create order'}
        </button>
      </form>
    </AppShell>
  )
}
