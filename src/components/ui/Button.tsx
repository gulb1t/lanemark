import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'bg-fg/[0.06] text-fg border border-line hover:bg-fg/[0.1]',
  outline: 'btn-glass',
  ghost: 'text-muted hover:text-fg hover:bg-fg/[0.06]',
  danger: 'bg-bad/10 text-bad border border-bad/30 hover:bg-bad/18',
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[13px] gap-1.5 rounded-full',
  md: 'h-10 px-5 text-sm gap-2 rounded-full',
  lg: 'h-12 px-7 text-[15px] gap-2.5 rounded-full',
}

function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra = '') {
  return `inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,border-color,color,filter,transform,box-shadow] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${SIZE[size]} ${VARIANT[variant]} ${extra}`
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
}

export function Button({ variant = 'secondary', size = 'md', icon, loading, className = '', children, type = 'button', disabled, ...rest }: Props) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function ButtonLink({ variant = 'secondary', size = 'md', icon, className = '', children, ...rest }: LinkProps & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tone?: 'default' | 'danger'
  size?: 'sm' | 'md'
}

export function IconButton({ label, tone = 'default', size = 'md', className = '', children, type = 'button', ...rest }: IconButtonProps) {
  const color = tone === 'danger' ? 'text-dim hover:text-bad hover:bg-bad/10' : 'text-dim hover:text-fg hover:bg-fg/[0.07]'
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg transition-[color,background-color,transform] active:scale-90 disabled:pointer-events-none disabled:opacity-30 ${size === 'sm' ? 'size-7' : 'size-9'} ${color} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
