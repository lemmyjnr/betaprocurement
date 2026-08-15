import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-steel">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

export function RequireAdmin({ children }) {
  const { session, loading, isAdmin } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-steel">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}
