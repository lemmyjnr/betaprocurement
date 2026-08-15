import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import FormField, { TextInput, PrimaryButton } from '../components/FormField'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ identifier: '', password: '' })
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
      await signIn(form)
      navigate('/')
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
    <AuthLayout eyebrow="Welcome back" title="Log in" subtitle="Use the phone number or email you signed up with.">
      <form onSubmit={handleSubmit}>
        <FormField label="Phone number or email">
          <TextInput
            required
            value={form.identifier}
            onChange={update('identifier')}
            placeholder="0808 337 1869 or you@example.com"
          />
        </FormField>

        <FormField label="Password">
          <TextInput
            required
            type="password"
            value={form.password}
            onChange={update('password')}
            placeholder="Your password"
          />
        </FormField>

        {error && <p className="text-sm text-alert mb-4">{error}</p>}

        <PrimaryButton type="submit" loading={loading}>
          Log in
        </PrimaryButton>
      </form>

      <p className="text-sm text-steel mt-6 text-center">
        New here?{' '}
        <Link to="/signup" className="text-ink font-medium hover:text-amber">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
