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

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(null)

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

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim() || !profile) return
    setSearching(true)
    const { data } = await supabase
      .from('tracking_numbers')
      .select('*, batches!inner(id, batch_code, customer_id)')
      .eq('batches.customer_id', profile.id)
      .ilike('waybill_number', `%${query.trim()}%`)
      .limit(10)
    setResults(data || [])
    setSearching(false)
  }

  const pending = batches.filter((b) => b.status === 'submitted' || b.status === 'received').length
  const undelivered = batches.filter((b) => b.status !== 'delivered').length

  return (
    <AppShell title={`Good to see you, ${profile?.full_name?.split(' ')[0] || ''}`}>
      {profile && !profile.email && (
        <Link
          to="/account"
          className="mb-6 flex items-center justify-between gap-4 rounded-md border border-amber bg-amber-dim px-4 py-3 text-sm hover:border-ink transition-colors"
        >
          <span className="text-ink">Add your email so we can send you shipment status updates.</span>
          <span className="font-medium text-ink whitespace-nowrap">Add email →</span>
        </Link>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="manifest-card p-5">
          <div className="text-xs uppercase tracking-wide text-steel mb-1">Pending orders</div>
          <div className="font-display text-3xl font-semibold text-ink">{pending}</div>
        </div>
        <div className="manifest-card p-5">
          <div className="text-xs uppercase tracking-wide text-steel mb-1">Undelivered orders</div>
          <div className="font-display text-3xl font-semibold text-ink">{undelivered}</div>
        </div>
      </div>

      <div className="mb-8">
        <form onSubmit={handleSearch} className="flex gap-2 mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your tracking numbers"
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
                  to={`/batches/${t.batches.id}`}
                  className="manifest-card p-3 flex items-center justify-between hover:border-amber transition-colors"
                >
                  <div>
                    <div className="font-mono text-sm text-ink">{t.waybill_number}</div>
                    <div className="text-xs text-steel mt-0.5">{t.batches.batch_code}</div>
                  </div>
                  <StatusStamp status={t.status} />
                </Link>
              ))}
            </div>
          )
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold text-ink">Recent orders</h2>
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
            Upload your first order
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
