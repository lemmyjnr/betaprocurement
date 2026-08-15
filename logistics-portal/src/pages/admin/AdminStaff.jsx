import { useEffect, useState } from 'react'
import AppShell from '../../components/AppShell'
import FormField, { TextInput, PrimaryButton } from '../../components/FormField'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

export default function AdminStaff() {
  const { createStaffInvite, profile } = useAuth()
  const [staff, setStaff] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  function load() {
    Promise.all([
      supabase.from('profiles').select('*').eq('role', 'admin').order('created_at', { ascending: false }),
      supabase
        .from('staff_invites')
        .select('*')
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
    ]).then(([staffRes, invitesRes]) => {
      setStaff(staffRes.data || [])
      setInvites(invitesRes.data || [])
      setLoading(false)
    })
  }

  useEffect(load, [])

  function inviteLink(inviteId) {
    return `${window.location.origin}/staff-invite/${inviteId}`
  }

  async function handleCreateInvite(e) {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      await createStaffInvite({ note: note.trim() || null })
      setNote('')
      load()
    } catch (err) {
      setError(err.message || 'Could not create an invite link.')
    } finally {
      setCreating(false)
    }
  }

  function copyLink(inviteId) {
    navigator.clipboard.writeText(inviteLink(inviteId))
    setCopiedId(inviteId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <AppShell title="Staff">
      <p className="text-sm text-steel mb-6 max-w-lg">
        Generate a link and send it to whoever you want on the admin side — they'll set their own password
        through it. Anyone with admin access can see everything: customers, batches, and packing lists, so
        only send this to people you trust with that.
      </p>

      <form onSubmit={handleCreateInvite} className="manifest-card p-5 mb-8 max-w-md">
        <FormField label="Note (optional, just for your own reference)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. for Chidi" />
        </FormField>
        {error && <p className="text-sm text-alert mb-4">{error}</p>}
        <PrimaryButton type="submit" loading={creating}>
          Generate invite link
        </PrimaryButton>
      </form>

      {loading ? (
        <p className="text-sm text-steel">Loading…</p>
      ) : (
        <>
          {invites.length > 0 && (
            <div className="mb-10">
              <h2 className="text-sm font-semibold text-ink mb-3">Pending invites</h2>
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="manifest-card p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm text-ink font-medium">{inv.note || 'Untitled invite'}</div>
                      <div className="text-xs text-steel mt-0.5 truncate">{inviteLink(inv.id)}</div>
                    </div>
                    <button
                      onClick={() => copyLink(inv.id)}
                      className="shrink-0 text-xs font-medium text-white bg-ink rounded-md px-3 py-1.5 hover:bg-ink-soft transition-colors"
                    >
                      {copiedId === inv.id ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="text-sm font-semibold text-ink mb-3">Staff</h2>
          <div className="space-y-2">
            {staff.map((s) => (
              <div key={s.id} className="manifest-card p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm text-ink font-medium">
                    {s.full_name}
                    {s.id === profile?.id && <span className="text-steel font-normal"> (you)</span>}
                  </div>
                  <div className="text-xs text-steel mt-0.5">{s.phone}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  )
}
