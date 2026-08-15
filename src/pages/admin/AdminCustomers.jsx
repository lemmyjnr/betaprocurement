import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import FormField, { TextInput, PrimaryButton } from '../../components/FormField'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

export default function AdminCustomers() {
  const { adminCreateCustomer } = useAuth()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fullName: '', shippingName: '', phone: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  function loadCustomers() {
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCustomers(data || [])
        setLoading(false)
      })
  }

  useEffect(loadCustomers, [])

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      await adminCreateCustomer(form)
      setForm({ fullName: '', shippingName: '', phone: '', email: '', password: '' })
      setShowForm(false)
      loadCustomers()
    } catch (err) {
      setError(err.message || 'Could not create this customer.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <AppShell title="Customers">
      <button
        onClick={() => setShowForm((s) => !s)}
        className="mb-6 text-sm font-medium text-white bg-ink rounded-md px-4 py-2 hover:bg-ink-soft transition-colors"
      >
        {showForm ? 'Cancel' : '+ Create customer account'}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="manifest-card p-5 mb-8 max-w-md">
          <p className="text-xs text-steel mb-4">
            Use this when you&rsquo;re setting up an account on a client&rsquo;s behalf. These accounts skip phone
            verification since your team is confirming the customer directly.
          </p>
          <FormField label="Full name">
            <TextInput required value={form.fullName} onChange={update('fullName')} />
          </FormField>
          <FormField label="Shipping name">
            <TextInput required value={form.shippingName} onChange={update('shippingName')} />
          </FormField>
          <FormField label="Phone number">
            <TextInput required type="tel" value={form.phone} onChange={update('phone')} />
          </FormField>
          <FormField label="Email (optional)">
            <TextInput type="email" value={form.email} onChange={update('email')} />
          </FormField>
          <FormField label="Temporary password">
            <TextInput required type="text" minLength={6} value={form.password} onChange={update('password')} />
          </FormField>
          {error && <p className="text-sm text-alert mb-4">{error}</p>}
          <PrimaryButton type="submit" loading={creating}>
            Create account
          </PrimaryButton>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-steel">Loading…</p>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <Link
              key={c.id}
              to={`/admin/customers/${c.id}`}
              className="manifest-card p-4 flex items-center justify-between hover:border-amber transition-colors"
            >
              <div>
                <div className="text-sm text-ink font-medium">{c.full_name}</div>
                <div className="text-xs text-steel mt-0.5">{c.phone}</div>
              </div>
              <span className={`stamp ${c.phone_verified ? 'text-cargo' : 'text-steel'}`}>
                {c.phone_verified ? 'Verified' : 'Unverified'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  )
}
