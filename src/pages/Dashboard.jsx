import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import StatusStamp from '../components/StatusStamp'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
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
      .limit(5)
      .then(({ data }) => {
        setBatches(data || [])
        setLoading(false)
      })
  }, [profile])

  const pending = batches.filter((b) => b.status === 'submitted' || b.status === 'received').length
  const undelivered = batches.filter((b) => b.status !== 'delivered').length

  return (
    <AppShell title={`Good to see you, ${profile?.full_name?.split(' ')[0] || ''}`}>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="manifest-card p-5">
          <div className="text-xs uppercase tracking-wide text-steel mb-1">Pending batches</div>
          <div className="font-display text-3xl font-semibold text-ink">{pending}</div>
        </div>
        <div className="manifest-card p-5">
          <div className="text-xs uppercase tracking-wide text-steel mb-1">Undelivered batches</div>
          <div className="font-display text-3xl font-semibold text-ink">{undelivered}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold text-ink">Recent batches</h2>
        <Link to="/batches/new" className="text-sm font-medium text-amber hover:text-ink">
          + Upload tracking numbers
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-steel">Loading…</p>
      ) : batches.length === 0 ? (
        <div className="manifest-card p-8 text-center">
          <p className="text-sm text-steel mb-4">You haven&rsquo;t uploaded any tracking numbers yet.</p>
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
                <div className="text-xs text-steel mt-0.5">
                  {b.tracking_numbers?.[0]?.count ?? 0} tracking number(s)
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
