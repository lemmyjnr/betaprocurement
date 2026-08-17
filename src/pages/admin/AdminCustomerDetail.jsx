import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import StatusStamp from '../../components/StatusStamp'
import { supabase } from '../../lib/supabaseClient'
import { formatServiceType, formatRoute } from '../../lib/labels'

function EmailEditor({ customer, onSaved }) {
  const [email, setEmail] = useState(customer?.email || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const { error } = await supabase
      .from('profiles')
      .update({ email: email.trim().toLowerCase() || null })
      .eq('id', customer.id)
    setSaving(false)
    setMessage(error ? error.message : 'Saved.')
    if (!error) onSaved(email.trim().toLowerCase())
  }

  return (
    <form onSubmit={handleSave} className="flex items-center gap-2 mt-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Add an email for shipment updates"
        className="rounded-md border border-steel-line bg-white px-3 py-1.5 text-sm text-ink w-64 focus:border-amber outline-none"
      />
      <button
        type="submit"
        disabled={saving}
        className="text-sm font-medium text-white bg-ink rounded-md px-3 py-1.5 hover:bg-ink-soft disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      {message && <span className="text-xs text-steel">{message}</span>}
    </form>
  )
}

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
        <EmailEditor
          customer={customer}
          onSaved={(email) => setCustomer((c) => ({ ...c, email }))}
        />
      </div>

      <h2 className="font-display text-lg font-semibold text-ink mb-3">Orders</h2>
      {batches.length === 0 ? (
        <p className="text-sm text-steel">No orders yet.</p>
      ) : (
        <div className="space-y-2">
          {batches.map((b) => (
            <Link
              key={b.id}
              to={`/admin/batches/${b.id}`}
              className="manifest-card p-4 flex items-center justify-between hover:border-amber transition-colors"
            >
              <span className="font-mono text-sm text-ink">{b.batch_code}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-steel">
                  {b.service_type && formatServiceType(b.service_type)}
                  {b.route && ` · ${formatRoute(b.route)}`}
                </span>
                <StatusStamp status={b.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  )
}
