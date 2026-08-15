import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import StatusStamp from '../../components/StatusStamp'
import { supabase } from '../../lib/supabaseClient'

export default function AdminCustomerDetail() {
  const { id } = useParams()
  const [customer, setCustomer] = useState(null)
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: c }, { data: b }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('batches').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      ])
      setCustomer(c)
      setBatches(b || [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <AppShell title="Customer">
        <p className="text-sm text-steel">Loading…</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mb-8">
        <div className="font-mono text-xs text-steel uppercase tracking-wide mb-1">Customer</div>
        <h1 className="font-display text-2xl font-semibold text-ink">{customer?.full_name}</h1>
        <div className="text-sm text-steel mt-1">
          {customer?.phone} · Ships as &ldquo;{customer?.shipping_name}&rdquo;
        </div>
      </div>

      <h2 className="font-display text-lg font-semibold text-ink mb-3">Batches</h2>
      {batches.length === 0 ? (
        <p className="text-sm text-steel">No batches yet.</p>
      ) : (
        <div className="space-y-2">
          {batches.map((b) => (
            <Link
              key={b.id}
              to={`/admin/batches/${b.id}`}
              className="manifest-card p-4 flex items-center justify-between hover:border-amber transition-colors"
            >
              <span className="font-mono text-sm text-ink">{b.batch_code}</span>
              <StatusStamp status={b.status} />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  )
}
