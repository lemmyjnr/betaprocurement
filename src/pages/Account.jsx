import { useState } from 'react'
import AppShell from '../components/AppShell'
import FormField, { TextInput, PrimaryButton } from '../components/FormField'
import { supabase } from '../lib/supabaseClient'

export default function Account() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('')
    if (password.length < 6) {
      setStatus('error:Password must be at least 6 characters.')
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
    <AppShell title="Change password">
      <form onSubmit={handleSubmit} className="max-w-sm">
        <FormField label="New password">
          <TextInput
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <FormField label="Confirm new password">
          <TextInput
            required
            type="password"
            minLength={6}
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
    </AppShell>
  )
}
