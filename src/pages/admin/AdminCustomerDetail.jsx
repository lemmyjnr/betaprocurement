import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import StatusStamp from '../../components/StatusStamp'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { formatServiceType, formatRoute } from '../../lib/labels'

function PasswordReset({ customerId }) {
  const { adminResetPassword } = useAuth()
  const [open, setOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function handleReset(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await adminResetPassword(customerId, newPassword)
      setMessage('Password updated \u2014 let the customer know their new password directly.')
      setNewPassword('')
    } catch (err) {
      // supabase-js throws this exact generic message when the Edge
      // Function itself can't be reached (e.g. it hasn't been
      // deployed to the project yet) — as opposed to the function
      // running and returning its own error. Worth telling admin
      // the difference, since the fix for one is "type a shorter
      // password" and the fix for the other is "deploy the function".
      if (err.message?.includes('Failed to send a request to the Edge Function')) {
        setMessage('Password reset isn\u2019t set up on the server yet \u2014 the admin-reset-password function needs to be deployed. See the README.')
      } else {
        setMessage(err.message || 'Could not reset this password.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-medium text-amber hover:text-ink mt-2">
        Reset password
      </button>
    )
  }

  return (
    <form onSubmit={handleReset} className="flex items-center gap-2 mt-2">
      <input
        required
        minLength={6}
        type="text"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="New password"
        className="rounded-md border border-steel-line bg-white px-3 py-1.5 text-sm text-ink w-48 focus:border-amber outline-none"
      />
      <button
        type="submit"
        disabled={saving}
        className="text-sm font-medium text-white bg-ink rounded-md px-3 py-1.5 hover:bg-ink-soft disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Set password'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-steel hover:text-ink">
        Cancel
      </button>
      {message && <span className="text-xs text-steel">{message}</span>}
    </form>
  )
}

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
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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

  async function handleDelete() {
    const confirmed = confirm(
      `Permanently delete ${customer?.full_name}\u2019s account? This removes their login completely, plus every ` +
        `order, tracking number, and packing list they have \u2014 ${batches.length} order(s) total. This can\u2019t be undone.`
    )
    if (!confirmed) return
    setDeleting(true)
    setDeleteError('')
    const { error } = await supabase.functions.invoke('delete-customer', {
      body: { customerId: id },
    })
    setDeleting(false)
    if (error) {
      setDeleteError(error.message)
      return
    }
    navigate('/admin/customers')
  }

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
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-xs text-steel uppercase tracking-wide mb-1">Customer</div>
            <h1 className="font-display text-2xl font-semibold text-ink">{customer?.full_name}</h1>
            <div className="text-sm text-steel mt-1">
              {customer?.phone} · Ships as &ldquo;{customer?.shipping_name}&rdquo;
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-alert hover:underline disabled:opacity-50 shrink-0"
          >
            {deleting ? 'Deleting…' : 'Delete customer'}
          </button>
        </div>
        {deleteError && <p className="text-xs text-alert mt-2">{deleteError}</p>}
        <EmailEditor
          customer={customer}
          onSaved={(email) => setCustomer((c) => ({ ...c, email }))}
        />
        <PasswordReset customerId={id} />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold text-ink">Orders</h2>
        <Link
          to={`/admin/customers/${id}/new-order`}
          className="text-sm font-medium text-white bg-ink rounded-md px-4 py-2 hover:bg-ink-soft transition-colors"
        >
          + New order for this customer
        </Link>
      </div>
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
