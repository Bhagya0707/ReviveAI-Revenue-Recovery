import { cn, titleize } from '../lib/utils'
import type { ActionStatus, Priority } from '../lib/api'

const STATUS_STYLES: Record<ActionStatus, string> = {
  executed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  escalated: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  stopped: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  pending: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
}

const PRIORITY_STYLES: Record<Priority, string> = {
  HIGH: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  MEDIUM: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  LOW: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
}

export function StatusChip({ status }: { status: ActionStatus }) {
  return <span className={cn('chip', STATUS_STYLES[status] ?? STATUS_STYLES.pending)}>{status}</span>
}

export function PriorityChip({ priority }: { priority: Priority | null }) {
  if (!priority) return <span className="chip border-ink-600 text-slate-400">—</span>
  return <span className={cn('chip', PRIORITY_STYLES[priority])}>{priority}</span>
}

export function ResultChip({ result }: { result: string | null }) {
  const styles =
    result === 'recovered'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : result === 'failed'
        ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
        : 'border-ink-600 bg-ink-800 text-slate-400'
  return <span className={cn('chip', styles)}>{titleize(result ?? 'pending')}</span>
}
