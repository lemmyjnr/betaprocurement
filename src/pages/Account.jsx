import { useState } from 'react'
import AppShell from '../components/AppShell'
import FormField, { TextInput, PasswordInput, PrimaryButton } from '../components/FormField'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function EmailSection() {
  const { profile, refreshProfile } = useAuth()
  const [email, setEmail] = useState(profile?.email || '')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('')
    setLoading(true)
    // This only updates the contact email we send updates to — it's
    // separate from whatever you actually log in with, so this never
    // touches your password or login. See profiles.email vs
    // profiles.auth_email if that distinction matters later.
    const { error } = await supabase
      .from('profiles')
      .update({ email: email.trim().toLowerCase() })
      .eq('id', profile.id)
    setLoading(false)
    if (error) {
      setStatus(`error:${error.message}`)
    } else {
      setStatus('success:Email saved.')
      await refreshProfile()
    }
  }

  const [kind, message] = status.includes(':') ? status.split(':') : [null, null]

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mb-10">
      <h2 className="font-display text-lg font-semibold text-ink mb-1">Email address</h2>
      <p className="text-sm text-steel mb-4">
        {profile?.email
          ? 'Where we send shipment status updates.'
          : "You signed up before this was required — add one so we can send you shipment status updates."}
      </p>
      <FormField label="Email">
        <TextInput
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </FormField>

      {message && <p className={`text-sm mb-4 ${kind === 'error' ? 'text-alert' : 'text-cargo'}`}>{message}</p>}

      <PrimaryButton type="submit" loading={loading}>
        Save email
      </PrimaryButton>
    </form>
  )
}

function PasswordSection() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('')
    if (password.length < 8) {
      setStatus('error:Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setStatus('error:Passwords don\u2019t match.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    setStatus(error ? `error:${error.message}` : 'success:Password updated.')
    setPassword('')
    setConfirm('')
  }

  const [kind, message] = status.includes(':') ? status.split(':') : [null, null]

  return (
    <form onSubmit={handleSubmit} className="max-w-sm">
      <h2 className="font-display text-lg font-semibold text-ink mb-4">Change password</h2>
      <FormField label="New password">
        <PasswordInput
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </FormField>
      <FormField label="Confirm new password">
        <PasswordInput
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </FormField>

      {message && (
        <p className={`text-sm mb-4 ${kind === 'error' ? 'text-alert' : 'text-cargo'}`}>{message}</p>
      )}

      <PrimaryButton type="submit" loading={loading}>
        Update password
      </PrimaryButton>
    </form>
  )
}

export default function Account() {
  return (
    <AppShell title="Account">
      <EmailSection />
      <PasswordSection />
    </AppShell>
  )
}
