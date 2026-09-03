// One app, two front doors. The real setup (once domains are live)
// is two subdomains pointing at this same deployment — see ADMIN_HOSTS
// below. Until then, ?portal=admin on the URL does the same job for
// testing, so there's a stable admin-portal link to hand out before
// DNS is connected.
//
// Either way, this is a UX nicety, not a security boundary —
// ProtectedRoute.jsx already enforces who can actually see admin
// pages, regardless of which URL they came in through.
//
// Update this list once the client's real subdomains are live.
const ADMIN_HOSTS = ['admin.betalogistics.ng', 'admin-betaprocurement.vercel.app']

export function isAdminHost() {
  if (ADMIN_HOSTS.includes(window.location.hostname)) return true
  return new URLSearchParams(window.location.search).get('portal') === 'admin'
}
