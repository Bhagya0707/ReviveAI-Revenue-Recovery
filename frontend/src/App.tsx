import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import { CaseInspector } from './components/CaseInspector'
import { FilterTabs, type CaseFilter } from './components/FilterTabs'
import { KpiRibbon } from './components/KpiRibbon'
import { RecoveryQueue } from './components/RecoveryQueue'
import {
  API_BASE_URL,
  executeRecovery,
  fetchEventDetail,
  fetchEvents,
  fetchSummary,
  type EventDetail,
  type RecoveryEvent,
  type Summary,
} from './lib/api'
import { formatDateTime } from './lib/utils'

function matchesFilter(event: RecoveryEvent, filter: CaseFilter) {
  if (filter === 'all') return true
  if (filter === 'recovered') return event.recovery_result === 'recovered'
  return event.action_status === filter
}

export default function App() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [events, setEvents] = useState<RecoveryEvent[]>([])
  const [filter, setFilter] = useState<CaseFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  const [detail, setDetail] = useState<EventDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [lastExecutedId, setLastExecutedId] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSummary, nextEvents] = await Promise.all([fetchSummary(), fetchEvents()])
      setSummary(nextSummary)
      setEvents(nextEvents)
      setRefreshedAt(new Date().toISOString())
      setError(null)
    } catch {
      setError(`Cannot reach the recovery API at ${API_BASE_URL}. Start the FastAPI backend on port 8000.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const counts = useMemo(
    () => ({
      all: events.length,
      executed: events.filter((e) => e.action_status === 'executed').length,
      escalated: events.filter((e) => e.action_status === 'escalated').length,
      stopped: events.filter((e) => e.action_status === 'stopped').length,
      recovered: events.filter((e) => e.recovery_result === 'recovered').length,
    }),
    [events],
  )

  const guardrailOverrides = useMemo(
    () => events.filter((e) => Boolean(e.guardrail_reason)).length,
    [events],
  )

  const visibleEvents = useMemo(
    () => events.filter((event) => matchesFilter(event, filter)),
    [events, filter],
  )

  const openCase = useCallback(async (event: RecoveryEvent) => {
    setDetailLoading(true)
    setExecutionError(null)
    setLastExecutedId(null)
    try {
      setDetail(await fetchEventDetail(event.event_id))
    } catch {
      setExecutionError('Could not load this case.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const runWorkflow = useCallback(async () => {
    if (!detail) return
    setExecuting(true)
    setExecutionError(null)
    try {
      const result = await executeRecovery(detail.event.event_id)
      setDetail({ event: result.event, audit_trail: result.audit_trail, outreach: result.outreach })
      setLastExecutedId(result.event_id)
      setEvents((current) =>
        current.map((event) => (event.event_id === result.event_id ? result.event : event)),
      )
      setSummary(await fetchSummary())
      setRefreshedAt(new Date().toISOString())
    } catch {
      setExecutionError('Execution failed. Check that the backend is running and the case is approved.')
    } finally {
      setExecuting(false)
    }
  }, [detail])

  return (
    <div className="min-h-full bg-ink-950">
      <div className="mx-auto max-w-[1400px] space-y-5 p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-300">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-100">ReviveAI · Revenue Recovery Control Room</h1>
              <p className="text-xs text-slate-500">
                AI recommendations under deterministic guardrails, with a full audit trail.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Updated {formatDateTime(refreshedAt)}</span>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-ink-800"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <KpiRibbon summary={summary} guardrailOverrides={guardrailOverrides} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterTabs active={filter} counts={counts} onChange={setFilter} />
          <p className="text-xs text-slate-500">Select a case to inspect the decision and run the workflow.</p>
        </div>

        <RecoveryQueue
          events={visibleEvents}
          selectedId={detail?.event.event_id ?? null}
          loading={loading}
          onSelect={(event) => void openCase(event)}
        />
      </div>

      <CaseInspector
        detail={detail}
        loading={detailLoading}
        executing={executing}
        executionError={executionError}
        lastExecutedId={lastExecutedId}
        onExecute={() => void runWorkflow()}
        onClose={() => {
          setDetail(null)
          setExecutionError(null)
        }}
      />
    </div>
  )
}
