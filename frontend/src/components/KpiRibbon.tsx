import { AlertTriangle, BadgeIndianRupee, Gauge, ShieldCheck, TrendingUp } from 'lucide-react'
import type { Summary } from '../lib/api'
import { cn, formatLakhs } from '../lib/utils'

interface Props {
  summary: Summary | null
  guardrailOverrides: number
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  sub: string
  icon: typeof Gauge
  tone: string
}) {
  return (
    <div className="panel flex flex-1 items-start gap-3 p-4">
      <div className={cn('rounded-lg border p-2', tone)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
        <p className="truncate text-xs text-slate-500">{sub}</p>
      </div>
    </div>
  )
}

export function KpiRibbon({ summary, guardrailOverrides }: Props) {
  const executed = summary?.status_breakdown.find((s) => s.action_status === 'executed')?.count ?? 0
  const escalated = summary?.status_breakdown.find((s) => s.action_status === 'escalated')?.count ?? 0
  const stopped = summary?.status_breakdown.find((s) => s.action_status === 'stopped')?.count ?? 0

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi
        label="Revenue at risk"
        value={formatLakhs(summary?.total_at_risk)}
        sub={`${executed + escalated + stopped} cases detected`}
        icon={AlertTriangle}
        tone="border-rose-500/30 bg-rose-500/10 text-rose-300"
      />
      <Kpi
        label="Selected for recovery"
        value={formatLakhs(summary?.total_recoverable)}
        sub={`${executed} guardrail-approved cases`}
        icon={BadgeIndianRupee}
        tone="border-sky-500/30 bg-sky-500/10 text-sky-300"
      />
      <Kpi
        label="Recovered"
        value={formatLakhs(summary?.total_recovered)}
        sub="Settled after execution"
        icon={TrendingUp}
        tone="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      />
      <Kpi
        label="Recovery rate"
        value={`${summary?.recovery_rate?.toFixed(1) ?? '0.0'}%`}
        sub="Recovered / attempted value"
        icon={Gauge}
        tone="border-violet-500/30 bg-violet-500/10 text-violet-300"
      />
      <Kpi
        label="Guardrail overrides"
        value={String(guardrailOverrides)}
        sub={`${escalated} escalated · ${stopped} stopped`}
        icon={ShieldCheck}
        tone="border-amber-500/30 bg-amber-500/10 text-amber-300"
      />
    </div>
  )
}
