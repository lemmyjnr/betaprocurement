import BrandMark from './BrandMark'

// Swap in a real courier/warehouse photo once you have one licensed
// for commercial use — drop the file in /public and point this at
// it, e.g. '/courier-photo.jpg'. Until then this quietly falls back
// to a plain dark panel instead of breaking or showing a missing
// image icon. See the README for where to get a free, properly
// licensed photo (Unsplash) and search terms that fit.
const COURIER_PHOTO_PATH = '/courier-photo.jpg'

export default function AuthLayout({ eyebrow, title, subtitle, children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-paper">
      <div
        className="hidden lg:flex flex-col justify-between bg-ink text-paper px-12 py-10 relative overflow-hidden"
        style={
          COURIER_PHOTO_PATH
            ? {
                backgroundImage: `linear-gradient(to bottom, rgba(18,32,58,0.75), rgba(18,32,58,0.92)), url(${COURIER_PHOTO_PATH})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="flex items-center gap-3">
          <BrandMark size={48} />
          <div>
            <div className="font-mono text-xs tracking-[0.2em] text-amber uppercase">Shipment Tracking</div>
            <div className="mt-0.5 font-display text-2xl font-semibold leading-tight">Beta Logistics</div>
          </div>
        </div>

        <p className="text-sm text-paper/70 mb-2 leading-relaxed max-w-sm">
          Every batch you upload gets its own reference code, so nothing
          from a past shipment ever mixes with a new one.
        </p>

        <p className="text-xs text-paper/40 font-mono">China - Dubai routes — Sea Freight, Air Freight &amp; Express</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <BrandMark size={40} />
            <div>
              <div className="font-mono text-xs tracking-[0.2em] text-amber uppercase">Shipment Tracking</div>
              <div className="mt-0.5 font-display text-xl font-semibold text-ink leading-tight">Beta Logistics</div>
            </div>
          </div>

          {eyebrow && (
            <div className="font-mono text-xs tracking-[0.15em] text-steel uppercase mb-2">{eyebrow}</div>
          )}
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{title}</h1>
          {subtitle && <p className="text-sm text-steel mb-8">{subtitle}</p>}

          {children}
        </div>
      </div>
    </div>
  )
}
