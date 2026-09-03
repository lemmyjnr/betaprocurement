import { useState } from 'react'
import { Link } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import { supabase } from '../lib/supabaseClient'
import { formatServiceType, formatRoute } from '../lib/labels'

const TRACKING_LABELS = { pending: 'Pending', received: 'Received' }
const BATCH_LABELS = {
  submitted: 'Submitted',
  received: 'Received',
  in_transit: 'In transit',
  arrived_port: 'Arrived at port',
  clearing: 'Clearing',
  delivered: 'Delivered',
}

export default function PublicTrack() {
  const [waybill, setWaybill] = useState('')
  const [result, setResult] = useState(null)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSearch(e) {
    e.preventDefault()
    if (!waybill.trim()) return
    setLoading(true)
    setSearched(true)
    const { data } = await supabase.rpc('public_track_waybill', { lookup: waybill.trim() })
    setResult(data?.[0] || null)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center px-6 py-16">
      <Link to="/" className="flex items-center gap-3 mb-10">
        <BrandMark size={44} />
        <div>
          <div className="font-mono text-xs tracking-[0.2em] text-amber uppercase">Shipment Tracking</div>
          <div className="font-display text-xl font-semibold text-ink leading-tight">Beta Logistics</div>
        </div>
      </Link>

      <div className="w-full max-w-md">
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">Track a shipment</h1>
        <p className="text-sm text-steel mb-8">Enter a waybill number — no account needed.</p>

        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <input
            value={waybill}
            onChange={(e) => setWaybill(e.target.value)}
            placeholder="e.g. 71009618"
            className="flex-1 rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm font-mono text-ink focus:border-amber outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-ink text-white font-medium text-sm px-5 py-2.5 hover:bg-ink-soft transition-colors disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Track'}
          </button>
        </form>

        {searched && !loading && (
          result ? (
            <div className="manifest-card p-5">
              <div className="font-mono text-sm text-ink mb-3">{result.waybill_number}</div>
              <div className="flex items-center justify-between py-2 border-t border-steel-line">
                <span className="text-sm text-steel">Waybill status</span>
                <span className="stamp text-amber">{TRACKING_LABELS[result.tracking_status] || result.tracking_status}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-steel-line">
                <span className="text-sm text-steel">Shipment status</span>
                <span className="stamp text-cargo">{BATCH_LABELS[result.batch_status] || result.batch_status}</span>
              </div>
              {result.service_type && (
                <div className="flex items-center justify-between py-2 border-t border-steel-line">
                  <span className="text-sm text-steel">Service</span>
                  <span className="text-sm text-ink">{formatServiceType(result.service_type)}</span>
                </div>
              )}
              {result.route && (
                <div className="flex items-center justify-between py-2 border-t border-steel-line">
                  <span className="text-sm text-steel">Route</span>
                  <span className="text-sm text-ink">{formatRoute(result.route)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-steel">No shipment found with that waybill number.</p>
          )
        )}
      </div>
    </div>
  )
}
