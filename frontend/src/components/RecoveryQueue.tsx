import type { RecoveryEvent } from '../lib/api'
import { cn, formatCurrency, titleize } from '../lib/utils'
import { PriorityChip, ResultChip, StatusChip } from './StatusChip'

interface Props {
  events: RecoveryEvent[]
  selectedId: string | null
  loading: boolean
  onSelect: (event: RecoveryEvent) => void
}

export function RecoveryQueue({ events, selectedId, loading, onSelect }: Props) {
  return (
    <div className="panel overflow-hidden">
      <div className="max-h-[62vh] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-ink-800 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Case</th>
              <th className="px-4 py-3 text-left font-medium">Failure</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-right font-medium">Recovery odds</th>
              <th className="px-4 py-3 text-left font-medium">Priority</th>
              <th className="px-4 py-3 text-left font-medium">AI action</th>
              <th className="px-4 py-3 text-left font-medium">Guardrail</th>
              <th className="px-4 py-3 text-left font-medium">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  Loading recovery queue…
                </td>
              </tr>
            )}
            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  No cases match this filter.
                </td>
              </tr>
            )}
            {events.map((event) => (
              <tr
                key={event.event_id}
                onClick={() => onSelect(event)}
                className={cn(
                  'cursor-pointer border-t border-ink-800 transition-colors hover:bg-ink-800/70',
                  selectedId === event.event_id && 'bg-ink-800',
                )}
              >
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-slate-300">{event.event_id}</p>
                  <p className="text-xs text-slate-500">{event.customer_id}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-300">{titleize(event.failure_reason)}</p>
                  <p className="text-xs text-slate-500">{titleize(event.event_type)}</p>
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-200">
                  {formatCurrency(event.amount)}
                </td>
                <td className="px-4 py-3 text-right text-slate-300">
                  {Math.round((event.recovery_probability ?? 0) * 100)}%
                </td>
                <td className="px-4 py-3">
                  <PriorityChip priority={event.priority} />
                </td>
                <td className="px-4 py-3 text-slate-300">{titleize(event.recommended_action)}</td>
                <td className="px-4 py-3">
                  <StatusChip status={event.action_status} />
                </td>
                <td className="px-4 py-3">
                  <ResultChip result={event.recovery_result} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
