import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import StatusStamp from '../../components/StatusStamp'
import { supabase } from '../../lib/supabaseClient'
import { formatServiceType, formatRoute } from '../../lib/labels'

export default function AdminBatches() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    supabase
      .from('batches')
      .select('*, profiles!batches_customer_id_fkey(full_name, phone)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBatches(data || [])
        setLoading(false)
      })
  }, [])

  const filtered = filter.trim()
    ? batches.filter((b) => {
        const q = filter.trim().toLowerCase()
        return (
          b.batch_code?.toLowerCase().includes(q) ||
          b.profiles?.full_name?.toLowerCase().includes(q) ||
          b.profiles?.phone?.includes(q)
        )
      })
    : batches

  return (
    <AppShell title="All orders">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by order code, customer name, or phone"
        className="w-full max-w-md mb-6 rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-amber outline-none"
      />

      {loading ? (
        <p className="text-sm text-steel">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-steel">No orders match that filter.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <Link
              key={b.id}
              to={`/admin/batches/${b.id}`}
              className="manifest-card p-4 flex items-center justify-between hover:border-amber transition-colors"
            >
              <div>
                <div className="font-mono text-sm text-ink">{b.batch_code}</div>
                <div className="text-xs text-steel mt-0.5">
                  {b.profiles?.full_name} · {b.profiles?.phone}
                </div>
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
