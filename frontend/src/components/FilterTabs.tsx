import { cn } from '../lib/utils'

export type CaseFilter = 'all' | 'executed' | 'escalated' | 'stopped' | 'recovered'

const TABS: { id: CaseFilter; label: string }[] = [
  { id: 'all', label: 'All cases' },
  { id: 'executed', label: 'Approved' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'stopped', label: 'Stopped' },
  { id: 'recovered', label: 'Recovered' },
]

interface Props {
  active: CaseFilter
  counts: Record<CaseFilter, number>
  onChange: (filter: CaseFilter) => void
}

export function FilterTabs({ active, counts, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            active === tab.id
              ? 'bg-ink-700 text-slate-100'
              : 'text-slate-400 hover:bg-ink-800 hover:text-slate-200',
          )}
        >
          {tab.label}
          <span className="ml-2 text-[11px] text-slate-500">{counts[tab.id]}</span>
        </button>
      ))}
    </div>
  )
}
