import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import FormField, { TextInput, PrimaryButton } from '../components/FormField'
import { useAuth } from '../context/AuthContext'

export default function SignUp() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', shippingName: '', phone: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signUp(form)
      // OTP verification isn't wired to a live SMS provider yet — see
      // VerifyPhone.jsx and the TODO in AuthContext.jsx. For now this
      // route shows what the flow looks like once that's connected.
      navigate('/verify-phone', { state: { phone: form.phone } })
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

        <FormField label="Email (optional)" error="Add this to also log in with email, or to reset your password later.">
          <TextInput
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
