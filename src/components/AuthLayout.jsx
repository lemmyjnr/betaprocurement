import BrandMark from './BrandMark'

// The signature visual for auth screens: a stack of "crates" built
// entirely from CSS, standing in for the batches/packages the whole
// product is organized around. No stock art, no plane/ship clip art.
function CrateStack() {
  const crates = [
    { code: 'BCH-0231', w: 72 },
    { code: 'BCH-0230', w: 100 },
    { code: 'BCH-0229', w: 84 },
  ]
  return (
    <div className="flex flex-col items-start gap-3">
      {crates.map((c, i) => (
        <div
          key={c.code}
          className="manifest-card px-4 py-3 flex items-center justify-between gap-6"
          style={{ width: `${c.w}%`, opacity: 1 - i * 0.18 }}
        >
          <span className="font-mono text-xs tracking-wide text-ink-soft">{c.code}</span>
          <span className="stamp text-cargo">received</span>
        </div>
      ))}
    </div>
  )
}

export default function AuthLayout({ eyebrow, title, subtitle, children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-paper">
      <div className="hidden lg:flex flex-col justify-between bg-ink text-paper px-12 py-10">
        <div className="flex items-center gap-3">
          <BrandMark size={48} />
          <div>
            <div className="font-mono text-xs tracking-[0.2em] text-amber uppercase">Shipment Tracking</div>
            <div className="mt-0.5 font-display text-2xl font-semibold leading-tight">Beta Logistics</div>
          </div>
        </div>

        <div className="max-w-sm">
          <p className="text-sm text-paper/70 mb-6 leading-relaxed">
            Every batch you upload gets its own reference code, so nothing
            from a past shipment ever mixes with a new one.
          </p>
          <CrateStack />
        </div>

        <p className="text-xs text-paper/40 font-mono">China · Dubai routes — Air Cargo &amp; Sea Shipping</p>
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
