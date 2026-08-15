import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import StatusStamp from '../../components/StatusStamp'
import { supabase } from '../../lib/supabaseClient'

export default function AdminOverview() {
  const [stats, setStats] = useState({ customers: 0, batches: 0, undelivered: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ count: customers }, { data: batches }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase
          .from('batches')
          .select('*, profiles!batches_customer_id_fkey(full_name)')
          .order('created_at', { ascending: false })
          .limit(8),
      ])
      setStats({
        customers: customers || 0,
        batches: batches?.length || 0,
        undelivered: (batches || []).filter((b) => b.status !== 'delivered').length,
      })
      setRecent(batches || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <AppShell title="Overview">
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="manifest-card p-5">
          <div className="text-xs uppercase tracking-wide text-steel mb-1">Customers</div>
          <div className="font-display text-3xl font-semibold text-ink">{stats.customers}</div>
        </div>
        <div className="manifest-card p-5">
          <div className="text-xs uppercase tracking-wide text-steel mb-1">Recent batches</div>
          <div className="font-display text-3xl font-semibold text-ink">{stats.batches}</div>
        </div>
        <div className="manifest-card p-5">
          <div className="text-xs uppercase tracking-wide text-steel mb-1">Undelivered</div>
          <div className="font-display text-3xl font-semibold text-ink">{stats.undelivered}</div>
        </div>
      </div>

      <h2 className="font-display text-lg font-semibold text-ink mb-3">Latest activity</h2>
      {loading ? (
        <p className="text-sm text-steel">Loading…</p>
      ) : (
        <div className="space-y-2">
          {recent.map((b) => (
            <Link
              key={b.id}
              to={`/admin/batches/${b.id}`}
              className="manifest-card p-4 flex items-center justify-between hover:border-amber transition-colors"
            >
              <div>
                <div className="font-mono text-sm text-ink">{b.batch_code}</div>
                <div className="text-xs text-steel mt-0.5">{b.profiles?.full_name}</div>
              </div>
              <StatusStamp status={b.status} />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  )
}
