import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import FormField, { TextInput, PasswordInput, PrimaryButton } from '../components/FormField'
import { useAuth } from '../context/AuthContext'

export default function StaffInvite() {
  const { inviteId } = useParams()
  const { checkStaffInvite, redeemStaffInvite } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [valid, setValid] = useState(false)
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    checkStaffInvite(inviteId)
      .then(setValid)
      .catch(() => setValid(false))
      .finally(() => setChecking(false))
  }, [inviteId])

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await redeemStaffInvite({ inviteId, ...form })
      navigate('/admin')
    } catch (err) {
      setError(
        err.message === 'INVALID_INVITE'
          ? 'This invite link has already been used or has expired.'
          : err.message || 'Something went wrong setting up your account.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <AuthLayout eyebrow="One moment" title="Checking your invite" subtitle="">
        <p className="text-sm text-steel">Please wait…</p>
      </AuthLayout>
    )
  }

  if (!valid) {
    return (
      <AuthLayout eyebrow="Staff invite" title="This link isn't valid" subtitle="">
        <p className="text-sm text-steel">
          This invite link has already been used or has expired. Ask whoever invited you to send a new one.
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Staff invite"
      title="Set up your admin account"
      subtitle="You'll be able to log in with your phone number or email from now on."
    >
      <form onSubmit={handleSubmit}>
        <FormField label="Full name">
          <TextInput required value={form.fullName} onChange={update('fullName')} />
        </FormField>
        <FormField label="Phone number">
          <TextInput required type="tel" value={form.phone} onChange={update('phone')} />
        </FormField>
        <FormField label="Email (optional)">
          <TextInput type="email" value={form.email} onChange={update('email')} />
        </FormField>
        <FormField label="Password">
          <PasswordInput required minLength={6} value={form.password} onChange={update('password')} />
        </FormField>
        {error && <p className="text-sm text-alert mb-4">{error}</p>}
        <PrimaryButton type="submit" loading={submitting}>
          Create account
        </PrimaryButton>
      </form>
    </AuthLayout>
  )
}
