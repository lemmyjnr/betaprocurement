import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import FormField, { TextInput, PrimaryButton } from '../components/FormField'
import { useAuth } from '../context/AuthContext'
import { isAdminHost } from '../lib/portalHost'

export default function SignUp() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', shippingName: '', phone: '', email: '', password: '' })
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Public self-signup is a customer thing — on the staff subdomain,
  // the only way in is a login, or an invite link from an existing admin.
  if (isAdminHost()) {
    return <Navigate to="/login" replace />
  }

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!agreed) {
      setError('Please agree to the Terms & Conditions to continue.')
      return
    }
    setLoading(true)
    try {
      await signUp(form)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Set up your account"
      subtitle="You'll use your phone number to log in from now on."
    >
      <form onSubmit={handleSubmit}>
        <FormField label="Full name">
          <TextInput
            required
            value={form.fullName}
            onChange={update('fullName')}
            placeholder="Uju Chiemeka"
          />
        </FormField>

        <FormField label="Shipping name" error="The name that should appear on your parcels and waybills.">
          <TextInput
            required
            value={form.shippingName}
            onChange={update('shippingName')}
            placeholder="Uju C. Ifeakor"
          />
        </FormField>

        <FormField label="Phone number">
          <TextInput
            required
            type="tel"
            value={form.phone}
            onChange={update('phone')}
            placeholder="0808 337 1869"
          />
        </FormField>

        <FormField label="Email address" error="We'll use this to send you shipment status updates.">
          <TextInput
            required
            type="email"
            value={form.email}
            onChange={update('email')}
            placeholder="you@example.com"
          />
        </FormField>

        <FormField label="Password">
          <TextInput
            required
            type="password"
            minLength={6}
            value={form.password}
            onChange={update('password')}
            placeholder="At least 6 characters"
          />
        </FormField>

        {error && <p className="text-sm text-alert mb-4">{error}</p>}

        <label className="flex items-start gap-2 mb-5 text-sm text-steel cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 rounded border-steel-line"
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" target="_blank" className="text-ink font-medium hover:text-amber underline">
              Terms &amp; Conditions
            </Link>
          </span>
        </label>

        <PrimaryButton type="submit" loading={loading}>
          Create account
        </PrimaryButton>
      </form>

      <p className="text-sm text-steel mt-6 text-center">
        Already have an account?{' '}
        <Link to="/login" className="text-ink font-medium hover:text-amber">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
