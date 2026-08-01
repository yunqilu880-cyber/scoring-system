import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

type PageHeaderProps = {
  eyebrow?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="ds-panel p-4 sm:p-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-2 leading-6">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 w-full lg:w-auto">{actions}</div>}
    </header>
  )
}

export function Panel({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('ds-panel', className)} {...props}>
      {children}
    </section>
  )
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="font-bold text-slate-900">{title}</h2>
        {description && <p className="text-xs text-slate-500 mt-1 leading-5">{description}</p>}
      </div>
      {action}
    </div>
  )
}

type Tone = 'slate' | 'cyan' | 'indigo' | 'emerald' | 'amber' | 'red' | 'violet' | 'sky'

const toneText: Record<Tone, string> = {
  slate: 'text-slate-900',
  cyan: 'text-blue-700',
  indigo: 'text-indigo-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  violet: 'text-violet-600',
  sky: 'text-sky-600',
}

const toneSoft: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  cyan: 'bg-blue-50 text-blue-700 ring-blue-100',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  red: 'bg-red-50 text-red-600 ring-red-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  sky: 'bg-sky-50 text-sky-700 ring-sky-100',
}

type StatCardProps = {
  label: ReactNode
  value: ReactNode
  tone?: Tone
  icon?: LucideIcon
  helper?: ReactNode
}

export function StatCard({ label, value, tone = 'slate', icon: Icon, helper }: StatCardProps) {
  return (
    <div className="ds-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className={cn('text-2xl font-bold mt-1', toneText[tone])}>{value}</p>
        </div>
        {Icon && (
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center ring-1', toneSoft[tone])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {helper && <p className="text-xs text-slate-400 mt-2">{helper}</p>}
    </div>
  )
}

export function FilterBar({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('ds-panel p-3 flex flex-col lg:flex-row gap-3', className)} {...props}>
      {children}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'soft'
type ButtonSize = 'sm' | 'md' | 'icon'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200/70',
  secondary: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
  soft: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  icon: 'h-9 w-9 p-0',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold disabled:pointer-events-none disabled:opacity-60',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Badge({
  tone = 'slate',
  className,
  children,
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={cn('inline-flex items-center w-fit text-xs px-2 py-0.5 rounded-full ring-1', toneSoft[tone], className)}>
      {children}
    </span>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description?: ReactNode
}) {
  return (
    <div className="ds-panel p-12 text-center text-slate-400">
      <Icon className="w-10 h-10 mx-auto mb-3" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
    </div>
  )
}

