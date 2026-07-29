import { cn } from '@/lib/utils'

export function StatusDot({
  status,
}: {
  status: 'ready' | 'limited' | 'offline'
}) {
  const map = {
    ready: 'bg-success',
    limited: 'bg-warning',
    offline: 'bg-muted-foreground/40',
  } as const
  return <span className={cn('size-2 rounded-full', map[status])} aria-hidden />
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
        className,
      )}
    >
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-foreground">{label}</label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function Chip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode
  variant?: 'default' | 'outline' | 'secondary'
  className?: string
}) {
  const variants = {
    default: 'bg-primary text-primary-foreground',
    outline: 'border border-border bg-background text-foreground',
    secondary: 'bg-secondary text-foreground',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * 必选且互斥的 Tag 单选组（docs/SPEC.md §0 / §6.4）。
 * 用于创意简报的「输出类型」等字段；点击已选项不会清空，始终保留一个选中值。
 */
export function RadioTags<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)} role="radiogroup">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'border-brand bg-brand-muted text-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
