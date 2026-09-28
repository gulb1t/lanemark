import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePhoneLayout } from '../../lib/hooks'
import { Modal } from './Modal'

export interface PickerOption {
  value: string
  label: string
  /** A second line, e.g. what's in it. */
  hint?: string
  /** Options with the same group are listed under that heading. */
  group?: string
}

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  options: PickerOption[]
  value?: string
  onPick: (value: string) => void
  /** Allow a value that isn't in the list; the text is the placeholder of the search box. */
  custom?: string
}

/**
 * A list to choose from, in a sheet: the phone's native dropdowns are small, can't be searched, and cut long names.
 * Search shows up once there's enough to search through; `custom` lets the typed text be used as it is.
 */
export function PickerSheet({ open, onClose, title, options, value, onPick, custom }: SheetProps) {
  const [query, setQuery] = useState('')
  const searchable = Boolean(custom) || options.length > 8
  const q = query.trim().toLowerCase()
  const shown = useMemo(() => (q ? options.filter((o) => `${o.label} ${o.hint ?? ''} ${o.group ?? ''}`.toLowerCase().includes(q)) : options), [options, q])
  const exact = options.some((o) => o.label.toLowerCase() === q)

  function pick(v: string) {
    onPick(v)
    setQuery('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setQuery('')
        onClose()
      }}
      title={title}
    >
      {searchable && (
        <label className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-2 rounded-xl border border-line-2 bg-ink px-3 focus-within:border-aqua/60">
          <Search size={16} className="shrink-0 text-dim" />
          <input
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-dim"
            placeholder={custom ?? 'Search'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && custom && query.trim()) {
                e.preventDefault()
                pick(query.trim())
              }
            }}
          />
        </label>
      )}
      <div role="listbox" aria-label={title} className="-mx-1">
        {custom && q && !exact && (
          <button type="button" onClick={() => pick(query.trim())} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] active:bg-fg/[0.06]">
            <Plus size={17} className="shrink-0 text-aqua" />
            <span className="min-w-0 flex-1">
              Use “<span className="font-medium">{query.trim()}</span>”
            </span>
          </button>
        )}
        {shown.map((o, i) => {
          const heading = o.group && o.group !== shown[i - 1]?.group ? o.group : null
          const on = o.value === value
          return (
            <div key={o.value}>
              {heading && <div className="px-3 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wide text-dim">{heading}</div>}
              <button
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => pick(o.value)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors active:bg-fg/[0.06] ${on ? 'bg-aqua/10' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] leading-snug ${on ? 'font-semibold' : ''}`}>{o.label}</span>
                  {o.hint && <span className="mt-0.5 block text-[13px] text-muted">{o.hint}</span>}
                </span>
                {on && <Check size={18} className="shrink-0 text-aqua" />}
              </button>
            </div>
          )
        })}
        {!shown.length && !custom && <p className="px-3 py-6 text-center text-[14px] text-muted">Nothing matches “{query.trim()}”.</p>}
      </div>
    </Modal>
  )
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: PickerOption[]
  /** Names the list (sheet title and accessible label). */
  label: string
  className?: string
}

/** A native <select> on wider screens; on phones, a field that opens the picker sheet. */
export function Select({ value, onChange, options, label, className = '' }: SelectProps) {
  const phone = usePhoneLayout()
  const [open, setOpen] = useState(false)
  if (!phone) {
    const groups = [...new Set(options.map((o) => o.group))]
    const list = (items: PickerOption[]) =>
      items.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))
    return (
      <select className={`input ${className}`} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {groups.map((g) =>
          g ? (
            <optgroup key={g} label={g}>
              {list(options.filter((o) => o.group === g))}
            </optgroup>
          ) : (
            list(options.filter((o) => !o.group))
          ),
        )}
      </select>
    )
  }
  const current = options.find((o) => o.value === value)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${label}: ${current?.label ?? 'none'}`} className={`input flex items-center gap-2 text-left ${className}`}>
        <span className="min-w-0 flex-1 truncate">{current?.label ?? 'Choose…'}</span>
        <ChevronDown size={16} className="shrink-0 text-dim" />
      </button>
      <PickerSheet open={open} onClose={() => setOpen(false)} title={label} options={options} value={value} onPick={onChange} />
    </>
  )
}
