import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { SERVICE_TYPES, SERVICE_TYPE_LABELS, ROUTES, ROUTE_LABELS } from '../lib/labels'

const emptyWaybill = () => ({ waybill_number: '' })

function generateBatchCode() {
  const year = new Date().getFullYear()
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `BCH-${year}-${rand}`
}

export default function NewBatch() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [serviceType, setServiceType] = useState('sea_freight')
  const [route, setRoute] = useState('china_nigeria')
  const [waybills, setWaybills] = useState([emptyWaybill()])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')

  // The session's user id is available the instant someone's logged
  // in, the profile row can take a moment longer to fetch. Prefer
  // profile.id when it's there (same value either way), but fall
  // back to the session so a fast click right after page load never
  // crashes on a still-loading profile.
  const customerId = profile?.id || session?.user?.id

  function updateWaybill(index, field, value) {
    setWaybills((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function addWaybill() {
    setWaybills((rows) => [...rows, emptyWaybill()])
  }

  function removeWaybill(index) {
    setWaybills((rows) => rows.filter((_, i) => i !== index))
  }

  // Splits on newlines OR commas, trims each one, drops blanks and
  // exact duplicates, then replaces the current list of rows —
  // meant for someone with a long list of waybills to add at once
  // instead of typing them in one by one.
  function applyPastedList() {
    const numbers = pasteText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const unique = [...new Set(numbers)]
    if (unique.length === 0) return
    setWaybills(unique.map((waybill_number) => ({ waybill_number })))
    setPasteText('')
    setShowPaste(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const validRows = waybills.filter((w) => w.waybill_number.trim())
    if (validRows.length === 0) {
      setError('Add at least one waybill number.')
      return
    }
    if (!customerId) {
      setError('Still loading your account — give it a second and try again.')
      return
    }

    setLoading(true)
    try {
      // This order code is what keeps this upload from ever mixing
      // with a previous one — every order, however many waybills it
      // holds, gets exactly one code.
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .insert({
          batch_code: generateBatchCode(),
          customer_id: customerId,
          created_by: customerId,
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

      navigate(`/batches/${batch.id}`)
    } catch (err) {
      setError(err.message || 'Could not submit this order. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell title="Upload tracking numbers">
      <p className="text-sm text-steel mb-6 max-w-xl">
        Add each waybill as a separate entry so it can be tracked individually. Everything you add here becomes
        one order, so future uploads never get mixed in with this one.
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

        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowPaste((s) => !s)}
            className="text-sm font-medium text-amber hover:text-ink"
          >
            {showPaste ? 'Cancel pasting a list' : 'Have a lot of waybills? Paste a list instead'}
          </button>
        </div>

        {showPaste && (
          <div className="manifest-card p-4 mb-6">
            <label className="block mb-3">
              <span className="block text-sm font-medium text-ink mb-1.5">
                Paste waybill numbers, one per line (or separated by commas)
              </span>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm font-mono text-ink focus:border-amber outline-none"
                placeholder={'71009618\n71009619\n71009620'}
              />
            </label>
            <button
              type="button"
              onClick={applyPastedList}
              className="text-sm font-medium text-white bg-ink rounded-md px-4 py-2 hover:bg-ink-soft transition-colors"
            >
              Use this list
            </button>
            <p className="text-xs text-steel mt-2">This replaces the waybills below with what you paste here.</p>
          </div>
        )}

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
                  onChange={(e) => updateWaybill(i, 'waybill_number', e.target.value)}
                  className="w-full rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm font-mono text-ink focus:border-amber outline-none"
                  placeholder="e.g. 71009618..."
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
          {loading ? 'Submitting…' : 'Submit order'}
        </button>
      </form>
    </AppShell>
  )
}
