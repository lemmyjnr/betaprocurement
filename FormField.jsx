import { useState } from 'react'

export default function FormField({ label, error, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      {children}
      {error && <span className="block text-xs text-alert mt-1.5">{error}</span>}
    </label>
  )
}

export function TextInput(props) {
  return (
    <input
      {...props}
      className="w-full rounded-md border border-steel-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-steel/60 focus:border-amber outline-none transition-colors"
    />
  )
}

export function PasswordInput(props) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className="w-full rounded-md border border-steel-line bg-white px-3.5 py-2.5 pr-16 text-sm text-ink placeholder:text-steel/60 focus:border-amber outline-none transition-colors"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-steel hover:text-ink"
        tabIndex={-1}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

export function PrimaryButton({ children, loading, ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className="w-full rounded-md bg-ink text-paper font-medium text-sm py-2.5 hover:bg-ink-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}
