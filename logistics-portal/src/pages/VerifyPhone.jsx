import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import FormField, { TextInput, PrimaryButton } from '../components/FormField'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function VerifyPhone() {
  const { session, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const phone = location.state?.phone
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // -----------------------------------------------------------
    // TODO: this is a placeholder until an SMS provider (Termii or
    // Africa's Talking) is connected. Right now it does not check
    // a real code — it just marks the profile verified so the rest
    // of the app (which expects phone_verified) can be built and
    // tested. Wire the real check here before this goes live with
    // real customers.
    // -----------------------------------------------------------
    if (code.length !== 6) {
      setError('Enter the 6-digit code sent to your phone.')
      return
    }

    setLoading(true)
    try {
      if (session?.user) {
        await supabase.from('profiles').update({ phone_verified: true }).eq('id', session.user.id)
        await refreshProfile()
      }
      navigate('/')
    } catch (err) {
      setError('Could not verify that code. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="One more step"
      title="Verify your phone"
      subtitle={phone ? `We sent a 6-digit code to ${phone}.` : 'Enter the 6-digit code sent to your phone.'}
    >
      <form onSubmit={handleSubmit}>
        <FormField label="Verification code">
          <TextInput
            required
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-lg font-mono tracking-[0.4em] text-center text-ink placeholder:text-steel/40 focus:border-amber outline-none transition-colors"
          />
        </FormField>

        {error && <p className="text-sm text-alert mb-4">{error}</p>}

        <PrimaryButton type="submit" loading={loading}>
          Verify and continue
        </PrimaryButton>
      </form>

      <p className="text-xs text-steel mt-6 text-center">
        Didn&rsquo;t get a code? SMS sending isn&rsquo;t connected in this build yet.
      </p>
    </AuthLayout>
  )
}
