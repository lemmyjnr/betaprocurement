import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import StatusStamp from '../../components/StatusStamp'
import { supabase } from '../../lib/supabaseClient'

export default function AdminBatches() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

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

  return (
    <AppShell title="All batches">
      {loading ? (
        <p className="text-sm text-steel">Loading…</p>
      ) : (
        <div className="space-y-2">
          {batches.map((b) => (
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
              </div>
              <StatusStamp status={b.status} />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  )
}
