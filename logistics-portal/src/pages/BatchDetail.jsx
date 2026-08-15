import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import StatusStamp from '../components/StatusStamp'
import { supabase } from '../lib/supabaseClient'
import { downloadPackingListCsv } from '../lib/exportCsv'

export default function BatchDetail() {
  const { id } = useParams()
  const [batch, setBatch] = useState(null)
  const [tracking, setTracking] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: b }, { data: t }, { data: pl }] = await Promise.all([
        supabase.from('batches').select('*').eq('id', id).single(),
        supabase.from('tracking_numbers').select('*').eq('batch_id', id).order('created_at'),
        supabase
          .from('packing_lists')
          .select('*, packing_list_items(*)')
          .eq('batch_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      setBatch(b)
      setTracking(t || [])
      setItems(pl?.packing_list_items || [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <AppShell title="Batch">
        <p className="text-sm text-steel">Loading…</p>
      </AppShell>
    )
  }

  if (!batch) {
    return (
      <AppShell title="Batch not found">
        <p className="text-sm text-steel">This batch doesn&rsquo;t exist or you don&rsquo;t have access to it.</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="font-mono text-xs text-steel uppercase tracking-wide mb-1">Batch</div>
          <h1 className="font-display text-2xl font-semibold text-ink font-mono">{batch.batch_code}</h1>
          <div className="text-sm text-steel mt-1 flex gap-2">
            {batch.service_type && <span className="capitalize">{batch.service_type.replace('_', ' ')}</span>}
            {batch.route && <span>· {batch.route.replace('_', ' \u2192 ')}</span>}
          </div>
        </div>
        <StatusStamp status={batch.status} />
      </div>

      <h2 className="font-display text-lg font-semibold text-ink mb-3">Tracking numbers</h2>
      <div className="space-y-2 mb-8">
        {tracking.map((t) => (
          <div key={t.id} className="manifest-card p-4 flex items-center justify-between">
            <div>
              <div className="font-mono text-sm text-ink">{t.waybill_number}</div>
              <div className="text-xs text-steel mt-0.5">
                {t.courier_name} · Qty {t.quantity}
              </div>
            </div>
            <StatusStamp status={t.status} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold text-ink">Packing list</h2>
        {items.length > 0 && (
          <button
            onClick={() => downloadPackingListCsv(batch.batch_code, items)}
            className="text-sm font-medium text-amber hover:text-ink"
          >
            Download CSV
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-steel">Not added yet. It&rsquo;ll appear here once our team fills it in.</p>
      ) : (
        <div className="manifest-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-steel-line text-left text-xs uppercase tracking-wide text-steel">
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Weight</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-steel-line last:border-0">
                  <td className="px-4 py-3 text-ink">{item.item_name}</td>
                  <td className="px-4 py-3 text-ink">{item.quantity}</td>
                  <td className="px-4 py-3 text-ink">
                    {item.weight ? `${item.weight} ${item.weight_unit}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-steel">{item.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}
