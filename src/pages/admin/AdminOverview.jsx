import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import StatusStamp from '../../components/StatusStamp'
import { supabase } from '../../lib/supabaseClient'
import { formatServiceType, formatRoute } from '../../lib/labels'

export default function AdminOverview() {
  const [stats, setStats] = useState({ customers: 0, batches: 0, undelivered: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(null)

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

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    const { data } = await supabase
      .from('tracking_numbers')
      .select('*, batches!inner(id, batch_code, profiles!batches_customer_id_fkey(full_name, phone))')
      .ilike('waybill_number', `%${query.trim()}%`)
      .limit(15)
    setResults(data || [])
    setSearching(false)
  }

  return (
    <AppShell title="Overview">
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="manifest-card p-5">
          <div className="text-xs uppercase tracking-wide text-steel mb-1">Customers</div>
          <div className="font-display text-3xl font-semibold text-ink">{stats.customers}</div>
        </div>
        <div className="manifest-card p-5">
          <div className="text-xs uppercase tracking-wide text-steel mb-1">Recent orders</div>
          <div className="font-display text-3xl font-semibold text-ink">{stats.batches}</div>
        </div>
        <div className="manifest-card p-5">
          <div className="text-xs uppercase tracking-wide text-steel mb-1">Undelivered</div>
          <div className="font-display text-3xl font-semibold text-ink">{stats.undelivered}</div>
        </div>
      </div>

      <div className="mb-8">
        <form onSubmit={handleSearch} className="flex gap-2 mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any customer's tracking numbers"
            className="flex-1 rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm font-mono text-ink focus:border-amber outline-none"
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded-md bg-ink text-white font-medium text-sm px-5 py-2.5 hover:bg-ink-soft transition-colors disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results !== null && (
          results.length === 0 ? (
            <p className="text-sm text-steel">No tracking numbers match that search.</p>
          ) : (
            <div className="space-y-2">
              {results.map((t) => (
                <Link
                  key={t.id}
                  to={`/admin/batches/${t.batches.id}`}
                  className="manifest-card p-3 flex items-center justify-between hover:border-amber transition-colors"
                >
                  <div>
                    <div className="font-mono text-sm text-ink">{t.waybill_number}</div>
                    <div className="text-xs text-steel mt-0.5">
                      {t.batches.batch_code} · {t.batches.profiles?.full_name} · {t.batches.profiles?.phone}
                    </div>
                  </div>
                  <StatusStamp status={t.status} />
                </Link>
              ))}
            </div>
          )
        )}
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
                <div className="text-xs text-steel mt-0.5">
                  {b.service_type && <span>{formatServiceType(b.service_type)}</span>}
                  {b.route && <span> · {formatRoute(b.route)}</span>}
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
