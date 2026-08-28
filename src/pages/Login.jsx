import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import FormField, { TextInput, PasswordInput, PrimaryButton } from '../components/FormField'
import { useAuth } from '../context/AuthContext'
import { isAdminHost } from '../lib/portalHost'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const adminHost = isAdminHost()

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Has to be set before signIn() — the Supabase client reads this
      // flag every time it stores the session. See supabaseClient.js.
      localStorage.setItem('sb-remember-me', rememberMe ? 'true' : 'false')
      await signIn(form)
      // If this isn't actually a staff member, RequireAdmin sends them
      // straight back to the customer dashboard — see ProtectedRoute.jsx.
      navigate(adminHost ? '/admin' : '/')
    } catch (err) {
      if (err.message === 'NO_ACCOUNT') {
        setError('We couldn\u2019t find an account with that phone number or email.')
      } else {
        setError('That password doesn\u2019t match our records.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow={adminHost ? 'Staff login' : 'Welcome back'}
      title="Log in"
      subtitle={
        adminHost
          ? 'This login is for Beta Logistics staff.'
          : 'Use the phone number or email you signed up with.'
      }
    >
      <form onSubmit={handleSubmit}>
        <FormField label="Phone number or email">
          <TextInput
            required
            value={form.identifier}
            onChange={update('identifier')}
            placeholder="080******* or you@example.com"
          />
        </FormField>

        <FormField label="Password">
          <PasswordInput
            required
            value={form.password}
            onChange={update('password')}
            placeholder="Your password"
          />
        </FormField>

        {error && <p className="text-sm text-alert mb-4">{error}</p>}

        <label className="flex items-center gap-2 mb-5 text-sm text-steel cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="rounded border-steel-line"
          />
          Remember me on this device
        </label>

        <PrimaryButton type="submit" loading={loading}>
          Log in
        </PrimaryButton>
      </form>

      {!adminHost && (
        <p className="text-sm text-steel mt-6 text-center">
          New here?{' '}
          <Link to="/signup" className="text-ink font-medium hover:text-amber">
            Create an account
          </Link>
        </p>
      )}
      {!adminHost && (
        <p className="text-xs text-steel mt-3 text-center">
          <Link to="/track" className="hover:text-amber">
            Track a shipment without logging in
          </Link>
        </p>
      )}
    </AuthLayout>
  )
}
