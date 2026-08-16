// The logo is navy-on-transparent, so it needs a light plate behind
// it wherever it sits on the dark ink background (sidebar, auth
// panel) — otherwise the navy text disappears into the navy bg.
export default function BrandMark({ size = 40 }) {
  return (
    <div
      className="bg-paper rounded-md flex items-center justify-center shrink-0 shadow-sm"
      style={{ width: size, height: size, padding: size * 0.12 }}
    >
      <img src="/logo.png" alt="Beta Logistics" className="w-full h-full object-contain" />
    </div>
  )
}
