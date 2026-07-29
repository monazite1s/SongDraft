import { cn } from '@/lib/utils'
import type { RunMode } from '@/lib/inspire-data'

export function ModeTag({
  mode,
  className,
}: {
  mode: RunMode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium leading-none',
        mode === 'real'
          ? 'border-success/30 bg-success/10 text-success-foreground'
          : 'border-warning/30 bg-warning/10 text-warning-foreground',
        className,
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          mode === 'real' ? 'bg-success' : 'bg-warning',
        )}
        aria-hidden
      />
      {mode === 'real' ? '真实生成' : '模拟输出'}
    </span>
  )
}

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
