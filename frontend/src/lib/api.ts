import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 20000 })

export type ActionStatus = 'executed' | 'escalated' | 'stopped' | 'pending'
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface RecoveryEvent {
  event_id: string
  customer_id: string
  event_type: string
  amount: number
  timestamp: string
  failure_reason: string
  payment_method: string
  retry_count: number
  previous_success_rate: number
  customer_lifetime_value: number
  days_since_last_payment: number
  risk_score: number | null
  recovery_probability: number | null
  priority: Priority | null
  diagnosis: string | null
  recommended_action: string | null
  action_reasoning: string | null
  action_status: ActionStatus
  recovery_result: string | null
  recovered_amount: number | null
  guardrail_reason?: string | null
}

export interface AuditLogEntry {
  log_id: number
  event_id: string
  timestamp: string
  step: string
  detail: string
}

export interface Outreach {
  action: string
  channel: string
  language: string
  message: string
}

export interface Summary {
  total_at_risk: number
  total_recoverable: number
  total_recovered: number
  recovery_rate: number
  status_breakdown: { action_status: ActionStatus; count: number }[]
  priority_breakdown: { priority: Priority; count: number }[]
  failure_reason_breakdown: { failure_reason: string; total_amount: number; count: number }[]
}

export interface EventDetail {
  event: RecoveryEvent
  audit_trail: AuditLogEntry[]
  outreach: Outreach
}

export interface ExecutionResult extends EventDetail {
  success: boolean
  event_id: string
  recovery_result: string
  recovered_amount: number
  adjusted_probability: number
}

export async function fetchSummary() {
  const { data } = await api.get<Summary>('/api/summary')
  return data
}

export async function fetchEvents() {
  const { data } = await api.get<RecoveryEvent[]>('/api/events')
  return data
}

export async function fetchEventDetail(eventId: string) {
  const { data } = await api.get<EventDetail>(`/api/events/${eventId}`)
  return data
}

export async function executeRecovery(eventId: string) {
  const { data } = await api.post<ExecutionResult>(`/api/recovery/${eventId}/execute`)
  return data
}
