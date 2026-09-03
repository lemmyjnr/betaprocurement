import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-steel">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

export function RequireAdmin({ children }) {
  const { session, loading, isAdmin, profile } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-steel">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (profile?.suspended) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink mb-2">Your access has been paused</h1>
          <p className="text-sm text-steel">Contact the account owner if you think this is a mistake.</p>
        </div>
      </div>
    )
  }
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

// The one admin allowed to bring on more staff. A regular admin who
// tries to reach this route just bounces to the normal admin
// dashboard — same as a customer trying to reach /admin does.
export function RequireOwner({ children }) {
  const { session, loading, isAdmin, isOwner } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-steel">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  if (!isOwner) return <Navigate to="/admin" replace />
  return children
}
