import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import StatusStamp from '../components/StatusStamp'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatServiceType, formatRoute } from '../lib/labels'

export default function BatchList() {
  const { profile } = useAuth()
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('batches')
      .select('*, tracking_numbers(count)')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBatches(data || [])
        setLoading(false)
      })
  }, [profile])

  return (
    <AppShell title="My orders">
      {loading ? (
        <p className="text-sm text-steel">Loading…</p>
      ) : batches.length === 0 ? (
        <div className="manifest-card p-8 text-center">
          <p className="text-sm text-steel mb-4">No batches yet.</p>
          <Link to="/batches/new" className="text-sm font-medium text-ink underline">
            Upload your first batch
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((b) => (
            <Link
              key={b.id}
              to={`/batches/${b.id}`}
              className="manifest-card p-4 flex items-center justify-between hover:border-amber transition-colors"
            >
              <div>
                <div className="font-mono text-sm text-ink">{b.batch_code}</div>
                <div className="text-xs text-steel mt-0.5 flex gap-2">
                  <span>{b.tracking_numbers?.[0]?.count ?? 0} tracking number(s)</span>
                  {b.service_type && <span>· {formatServiceType(b.service_type)}</span>}
                  {b.route && <span>· {formatRoute(b.route)}</span>}
                </div>
              </div>
              <StatusStamp status={b.status} />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  )
}
