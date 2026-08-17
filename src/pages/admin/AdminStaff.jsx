import { useEffect, useState } from 'react'
import AppShell from '../../components/AppShell'
import FormField, { TextInput, PrimaryButton } from '../../components/FormField'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

export default function AdminStaff() {
  const { createStaffInvite, setAdminSuspended, removeAdmin, profile } = useAuth()
  const [staff, setStaff] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [busyId, setBusyId] = useState(null)

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

  async function togglePause(member) {
    setBusyId(member.id)
    try {
      await setAdminSuspended(member.id, !member.suspended)
      load()
    } catch (err) {
      alert(err.message || 'Could not update this account.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(member) {
    if (!confirm(`Remove ${member.full_name}\u2019s admin access? This can\u2019t be undone from here.`)) return
    setBusyId(member.id)
    try {
      await removeAdmin(member.id)
      load()
    } catch (err) {
      alert(err.message || 'Could not remove this account.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppShell title="Staff">
      <p className="text-sm text-steel mb-6 max-w-lg">
        Generate a link and send it to whoever you want on the admin side — they'll set their own password
        through it. Anyone with admin access can see everything: customers, orders, and packing lists, so
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
            {staff.map((s) => {
              const isSelf = s.id === profile?.id
              return (
                <div key={s.id} className="manifest-card p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-ink font-medium flex items-center gap-2">
                      {s.full_name}
                      {isSelf && <span className="text-steel font-normal">(you)</span>}
                      {s.is_owner && (
                        <span className="text-[10px] uppercase tracking-wide bg-ink text-white rounded px-1.5 py-0.5">
                          Owner
                        </span>
                      )}
                      {s.suspended && (
                        <span className="text-[10px] uppercase tracking-wide bg-alert/10 text-alert rounded px-1.5 py-0.5">
                          Paused
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-steel mt-0.5">{s.phone}</div>
                  </div>

                  {!isSelf && !s.is_owner && (
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => togglePause(s)}
                        disabled={busyId === s.id}
                        className="text-xs font-medium text-ink hover:text-amber disabled:opacity-50"
                      >
                        {s.suspended ? 'Reactivate' : 'Pause'}
                      </button>
                      <button
                        onClick={() => handleRemove(s)}
                        disabled={busyId === s.id}
                        className="text-xs font-medium text-alert hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </AppShell>
  )
}
