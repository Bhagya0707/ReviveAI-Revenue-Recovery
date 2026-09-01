import { CheckCircle2, Loader2, MessageSquare, Play, ShieldAlert, X } from 'lucide-react'
import type { EventDetail } from '../lib/api'
import { cn, formatCurrency, formatDateTime, titleize } from '../lib/utils'
import { PriorityChip, ResultChip, StatusChip } from './StatusChip'

interface Props {
  detail: EventDetail | null
  loading: boolean
  executing: boolean
  executionError: string | null
  lastExecutedId: string | null
  onExecute: () => void
  onClose: () => void
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm text-slate-200">{value}</p>
    </div>
  )
}

export function CaseInspector({
  detail,
  loading,
  executing,
  executionError,
  lastExecutedId,
  onExecute,
  onClose,
}: Props) {
  const open = Boolean(detail) || loading

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-30 bg-black/60 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        className={cn(
          'fixed right-0 top-0 z-40 flex h-full w-full max-w-xl flex-col border-l border-ink-700 bg-ink-900 transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {loading && !detail && (
          <div className="flex flex-1 items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading case…
          </div>
        )}

        {detail && (
          <>
            <header className="flex items-start justify-between border-b border-ink-700 p-5">
              <div>
                <p className="font-mono text-xs text-slate-500">{detail.event.event_id}</p>
                <h2 className="text-lg font-semibold text-slate-100">
                  {formatCurrency(detail.event.amount)} · {titleize(detail.event.event_type)}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusChip status={detail.event.action_status} />
                  <PriorityChip priority={detail.event.priority} />
                  <ResultChip result={detail.event.recovery_result} />
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close case inspector"
                className="rounded-md p-1 text-slate-500 hover:bg-ink-800 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 space-y-5 overflow-auto p-5">
              <section className="grid grid-cols-2 gap-4">
                <Field label="Customer" value={detail.event.customer_id} />
                <Field label="Failure reason" value={titleize(detail.event.failure_reason)} />
                <Field label="Payment method" value={titleize(detail.event.payment_method)} />
                <Field label="Retries" value={String(detail.event.retry_count)} />
                <Field
                  label="Recovery probability"
                  value={`${Math.round((detail.event.recovery_probability ?? 0) * 100)}%`}
                />
                <Field label="Risk score" value={String(detail.event.risk_score ?? '—')} />
                <Field label="Lifetime value" value={formatCurrency(detail.event.customer_lifetime_value)} />
                <Field label="Detected" value={formatDateTime(detail.event.timestamp)} />
              </section>

              <section className="panel space-y-2 p-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">AI decision</p>
                <p className="text-sm text-slate-200">{detail.event.diagnosis ?? '—'}</p>
                <p className="text-sm text-slate-400">
                  Recommended: <span className="text-slate-200">{titleize(detail.event.recommended_action)}</span>
                </p>
                <p className="text-xs text-slate-500">{detail.event.action_reasoning ?? ''}</p>
              </section>

              <section
                className={cn(
                  'panel space-y-2 p-4',
                  detail.event.guardrail_reason && 'border-amber-500/30 bg-amber-500/5',
                )}
              >
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                  <ShieldAlert className="h-3.5 w-3.5" /> Guardrail verdict
                </p>
                <p className="text-sm text-slate-200">
                  {detail.event.guardrail_reason ??
                    `Approved: guardrails accepted '${titleize(detail.event.recommended_action)}'.`}
                </p>
              </section>

              <section className="panel space-y-2 p-4">
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                  <MessageSquare className="h-3.5 w-3.5" /> {detail.outreach.language} outreach preview ·{' '}
                  {detail.outreach.channel}
                </p>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm leading-relaxed text-emerald-100">
                  {detail.outreach.message}
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Audit trail</p>
                <ol className="space-y-3 border-l border-ink-700 pl-4">
                  {detail.audit_trail.map((log) => (
                    <li key={log.log_id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-ink-600" />
                      <p className="text-xs font-medium text-slate-300">
                        {log.step}
                        <span className="ml-2 font-normal text-slate-500">{formatDateTime(log.timestamp)}</span>
                      </p>
                      <p className="text-xs text-slate-400">{log.detail}</p>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <footer className="space-y-2 border-t border-ink-700 p-5">
              {executionError && <p className="text-xs text-rose-400">{executionError}</p>}
              {lastExecutedId === detail.event.event_id && !executionError && (
                <p className="flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Workflow executed — outcome{' '}
                  {titleize(detail.event.recovery_result)} and audit trail updated.
                </p>
              )}
              <button
                type="button"
                onClick={onExecute}
                disabled={executing || detail.event.action_status !== 'executed'}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors',
                  detail.event.action_status === 'executed'
                    ? 'bg-emerald-500 text-ink-950 hover:bg-emerald-400 disabled:opacity-60'
                    : 'cursor-not-allowed bg-ink-800 text-slate-500',
                )}
              >
                {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {detail.event.action_status === 'executed'
                  ? 'Execute Recovery Workflow'
                  : `Blocked by guardrails (${detail.event.action_status})`}
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  )
}
