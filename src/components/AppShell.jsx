import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BrandMark from './BrandMark'

function NavItem({ to, children, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `block px-3.5 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive ? 'bg-white text-ink' : 'text-paper/70 hover:text-paper hover:bg-white/5'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export default function AppShell({ children, title }) {
  const { profile, isAdmin, isOwner, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="bg-ink text-paper px-4 py-6 flex flex-col lg:sticky lg:top-0 lg:h-screen">
        <div className="px-2 mb-8 flex items-center gap-3">
          <BrandMark size={40} />
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-amber uppercase">Shipment Tracking</div>
            <div className="font-display text-lg font-semibold leading-tight">Beta Logistics</div>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {isAdmin ? (
            <>
              <div className="px-3.5 text-[11px] uppercase tracking-wide text-paper/40 mb-1">Order management</div>
              <NavItem to="/admin" end>
                Overview
              </NavItem>
              <NavItem to="/admin/customers">Customers</NavItem>
              <NavItem to="/admin/batches">All batches</NavItem>
              <NavItem to="/admin/packing-lists">Packing lists</NavItem>
              {isOwner && <NavItem to="/admin/staff">Staff</NavItem>}
            </>
          ) : (
            <>
              <NavItem to="/" end>
                Dashboard
              </NavItem>
              <NavItem to="/batches">My batches</NavItem>
              <NavItem to="/batches/new">Upload tracking numbers</NavItem>
              <NavItem to="/packing-lists">Packing lists</NavItem>
            </>
          )}
          <div className="px-3.5 text-[11px] uppercase tracking-wide text-paper/40 mt-6 mb-1">Account</div>
          <NavItem to="/account">Account</NavItem>
        </nav>

        <div className="px-2 pt-4 border-t border-white/10">
          <div className="text-sm font-medium truncate">{profile?.full_name}</div>
          <div className="text-xs text-paper/50 truncate mb-3">{profile?.phone}</div>
          <button
            onClick={handleSignOut}
            className="text-sm text-paper/70 hover:text-amber transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="px-6 py-8 lg:px-10 lg:py-10">
        {title && <h1 className="font-display text-2xl font-semibold text-ink mb-6">{title}</h1>}
        {children}
      </main>
    </div>
  )
}
