import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { downloadPackingListCsv } from '../lib/exportCsv'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function PackingLists() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('packing_lists')
      .select('*, packing_list_items(*), batches!inner(batch_code, customer_id)')
      .eq('batches.customer_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRows(data || [])
        setLoading(false)
      })
  }, [profile])

  return (
    <AppShell title="Packing lists">
      {loading ? (
        <p className="text-sm text-steel">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-steel">No packing lists added yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((pl) => (
            <div key={pl.id} className="manifest-card p-4 flex items-center justify-between">
              <div>
                <Link to={`/batches/${pl.batch_id}`} className="font-mono text-sm text-ink hover:text-amber">
                  {pl.batches?.batch_code}
                </Link>
                <div className="text-xs text-steel mt-0.5">{pl.packing_list_items?.length || 0} item(s)</div>
              </div>
              <button
                onClick={() => downloadPackingListCsv(pl.batches?.batch_code, pl.packing_list_items || [])}
                className="text-sm font-medium text-amber hover:text-ink"
              >
                Download CSV
              </button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  )
}
