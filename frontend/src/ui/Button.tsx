import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Square icon-only button. Requires aria-label. */
  shape?: 'default' | 'icon'
  pending?: boolean
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  shape = 'default',
  pending = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', shape === 'icon' && 'btn-icon', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={cls} disabled={disabled || pending} aria-busy={pending || undefined} {...rest}>
      {pending ? <span className="spinner" aria-hidden /> : null}
      {children}
    </button>
  )
}
