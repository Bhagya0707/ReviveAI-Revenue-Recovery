import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const API_URL = "https://reviveai-revenue-recovery.onrender.com";

const NAV_ITEMS = [
  { id: "overview", icon: "⌂", label: "Overview" },
  { id: "queue", icon: "☷", label: "Recovery Queue" },
  { id: "strategy", icon: "↗", label: "Strategy Simulator" },
  { id: "audit", icon: "◇", label: "Audit & Guardrails" },
  { id: "analytics", icon: "▥", label: "Analytics" },
];

const FALLBACK_SUMMARY = {
  total_at_risk: 3590080.21,
  total_recoverable: 942047.0,
  total_recovered: 520246.03,
  recovery_rate: 55.2,
  status_breakdown: [],
  priority_breakdown: [],
  failure_reason_breakdown: [],
};

function money(value) {
  const n = Number(value || 0);

  if (n >= 10000000) {
    return `₹${(n / 10000000).toFixed(2)}Cr`;
  }

  if (n >= 100000) {
    return `₹${(n / 100000).toFixed(2)}L`;
  }

  if (n >= 1000) {
    return `₹${(n / 1000).toFixed(1)}K`;
  }

  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function moneyFull(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function normalizeEvent(event) {
  return {
    ...event,
    event_id: event.event_id ?? event.id ?? "",
    customer_id: event.customer_id ?? event.customer ?? "Unknown",
    event_type: event.event_type ?? event.type ?? "Unknown",
    amount: Number(event.amount ?? 0),
    failure_reason: event.failure_reason ?? "unknown",
    payment_method: event.payment_method ?? "unknown",
    retry_count: Number(event.retry_count ?? 0),
    previous_success_rate: Number(event.previous_success_rate ?? 0),
    customer_lifetime_value: Number(event.customer_lifetime_value ?? 0),
    days_since_last_payment: Number(event.days_since_last_payment ?? 0),
    risk_score: Number(event.risk_score ?? 0),
    recovery_probability: Number(event.recovery_probability ?? 0),
    priority: event.priority ?? "LOW",
    diagnosis: event.diagnosis ?? "",
    recommended_action: event.recommended_action ?? "stop_attempts",
    action_status: event.action_status ?? "stopped",
    recovery_result: event.recovery_result ?? "not_attempted",
    recovered_amount: Number(event.recovered_amount ?? 0),
    timestamp: event.timestamp ?? "",
  };
}

function actionLabel(action) {
  const labels = {
    retry_payment: "Retry Payment",
    send_reminder: "Send Reminder",
    suggest_alternate_method: "Suggest Alternate Method",
    stop_attempts: "Stop Attempts",
    escalate_to_human: "Escalate to Human",
  };

  return labels[action] || String(action || "Review Case").replaceAll("_", " ");
}

function statusLabel(status) {
  const labels = {
    executed: "Executed",
    escalated: "Escalated",
    stopped: "Stopped",
  };

  return labels[status] || String(status || "Unknown").replaceAll("_", " ");
}

function prettyReason(reason) {
  return String(reason || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function priorityClass(priority) {
  return String(priority || "LOW").toLowerCase();
}

function formatDate(value) {
  if (!value) return "—";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Icon({ children }) {
  return <span className="nav-icon">{children}</span>;
}

function StatCard({ label, value, description, tone }) {
  return (
    <div className={`stat-card ${tone || ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-description">{description}</div>
    </div>
  );
}

function Badge({ children, type = "" }) {
  return <span className={`badge ${type}`}>{children}</span>;
}

function Modal({ event, onClose }) {
  if (!event) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="eyebrow">RECOVERY CASE</div>
            <h2>{event.customer_id}</h2>
            <div className="muted">{event.event_id}</div>
          </div>

          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-grid">
          <div className="detail-card">
            <span>Revenue at risk</span>
            <strong>{moneyFull(event.amount)}</strong>
          </div>

          <div className="detail-card">
            <span>Risk score</span>
            <strong>{event.risk_score.toFixed(1)}</strong>
          </div>

          <div className="detail-card">
            <span>Recovery probability</span>
            <strong>{percent(event.recovery_probability * 100)}</strong>
          </div>

          <div className="detail-card">
            <span>Recovered amount</span>
            <strong>{moneyFull(event.recovered_amount)}</strong>
          </div>
        </div>

        <div className="modal-section">
          <h3>Case information</h3>

          <div className="info-grid">
            <div>
              <span>Event type</span>
              <strong>{prettyReason(event.event_type)}</strong>
            </div>

            <div>
              <span>Failure reason</span>
              <strong>{prettyReason(event.failure_reason)}</strong>
            </div>

            <div>
              <span>Payment method</span>
              <strong>{prettyReason(event.payment_method)}</strong>
            </div>

            <div>
              <span>Retry count</span>
              <strong>{event.retry_count}</strong>
            </div>

            <div>
              <span>Customer lifetime value</span>
              <strong>{moneyFull(event.customer_lifetime_value)}</strong>
            </div>

            <div>
              <span>Days since last payment</span>
              <strong>{event.days_since_last_payment}</strong>
            </div>

            <div>
              <span>Priority</span>
              <Badge type={priorityClass(event.priority)}>
                {event.priority}
              </Badge>
            </div>

            <div>
              <span>Status</span>
              <Badge type={String(event.action_status).toLowerCase()}>
                {statusLabel(event.action_status)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="modal-section">
          <h3>AI decision</h3>

          <div className="decision-box">
            <div>
              <span>Recommended action</span>
              <strong>{actionLabel(event.recommended_action)}</strong>
            </div>

            <div>
              <span>Recovery result</span>
              <strong>{prettyReason(event.recovery_result)}</strong>
            </div>
          </div>

          {event.diagnosis && (
            <div className="diagnosis">
              <span>AI diagnosis</span>
              <p>{event.diagnosis}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <span>Recorded {formatDate(event.timestamp)}</span>
          <button className="primary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Overview({
  summary,
  events,
  onSelectEvent,
  onNavigate,
  apiConnected,
}) {
  const topCases = useMemo(() => {
    return [...events]
      .sort((a, b) => {
        const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (
          (priorityOrder[b.priority] || 0) -
            (priorityOrder[a.priority] || 0) ||
          b.amount - a.amount
        );
      })
      .slice(0, 5);
  }, [events]);

  const statusCounts = useMemo(() => {
    const result = {
      executed: 0,
      escalated: 0,
      stopped: 0,
    };

    events.forEach((e) => {
      if (result[e.action_status] !== undefined) {
        result[e.action_status]++;
      }
    });

    return result;
  }, [events]);

  const expectedRecovery = Number(summary.total_recoverable || 0);

  const optimizedEstimate = Math.max(
    Number(summary.total_recovered || 0),
    expectedRecovery
  );

  const additionalRecovery = Math.max(
    0,
    optimizedEstimate - expectedRecovery
  );

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">AI OPERATIONS / OVERVIEW</div>
          <h1>Recovery Analysis</h1>
          <p>
            Monitor exposed revenue and the actions being taken to recover it.
          </p>
        </div>

        <div className="live-status">
          <span className="live-dot" />
          LIVE
        </div>
      </header>

      {!apiConnected && (
        <div className="warning-banner">
          <span>⚠</span>
          Backend connection unavailable. Showing the last known dashboard
          values instead of inventing new data.
        </div>
      )}

      <div className="live-data-strip">
        <span className="green-dot" />
        Live · Demo data active
        <span className="separator">•</span>
        {events.length} recovery events loaded
      </div>

      <section className="stats-grid">
        <StatCard
          label="REVENUE AT RISK"
          value={money(summary.total_at_risk)}
          description="Total exposed revenue"
          tone="purple"
        />

        <StatCard
          label="SELECTED FOR RECOVERY"
          value={money(summary.total_recoverable)}
          description="AI-approved opportunities"
          tone="blue"
        />

        <StatCard
          label="REVENUE RECOVERED"
          value={money(summary.total_recovered)}
          description="Confirmed recovered revenue"
          tone="green"
        />

        <StatCard
          label="RECOVERY RATE"
          value={percent(summary.recovery_rate)}
          description="Of selected revenue"
          tone="orange"
        />
      </section>

      <section className="ai-impact-card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">AI IMPACT</div>
            <h2>Recovery policy optimization</h2>
            <p>
              Estimated revenue impact from AI-driven intervention selection.
            </p>
          </div>

          <button
            className="text-btn"
            onClick={() => onNavigate("strategy")}
          >
            View simulator →
          </button>
        </div>

        <div className="impact-grid">
          <div className="policy-panel">
            <div className="policy-label">CURRENT POLICY</div>
            <div className="policy-value">{money(expectedRecovery)}</div>
            <div className="policy-caption">Selected recovery value</div>

            <div className="mini-status-row">
              <span>
                <b>{statusCounts.executed}</b> Executed
              </span>
              <span>
                <b>{statusCounts.escalated}</b> Escalated
              </span>
              <span>
                <b>{statusCounts.stopped}</b> Stopped
              </span>
            </div>
          </div>

          <div className="policy-arrow">→</div>

          <div className="policy-panel optimized">
            <div className="policy-label">AI-OPTIMIZED POLICY</div>
            <div className="policy-value">{money(optimizedEstimate)}</div>
            <div className="policy-caption">
              Confirmed/expected recovery value
            </div>

            <div className="optimization-note">
              <span>✦</span>
              Uses actual recovery outcomes
            </div>
          </div>

          <div className="additional-panel">
            <div className="policy-label">ADDITIONAL RECOVERY</div>
            <div className="additional-value">
              +{money(additionalRecovery)}
            </div>

            <div className="improvement">
              {expectedRecovery > 0
                ? `${((additionalRecovery / expectedRecovery) * 100).toFixed(
                    1
                  )}%`
                : "0%"}{" "}
              potential improvement
            </div>
          </div>
        </div>
      </section>

      <section className="queue-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">PRIORITY QUEUE</div>
            <h2>Recovery opportunities</h2>
            <p>Highest-value cases recommended by the AI.</p>
          </div>

          <button className="text-btn" onClick={() => onNavigate("queue")}>
            View all →
          </button>
        </div>

        <div className="priority-list">
          {topCases.map((event, index) => (
            <button
              className="priority-row"
              key={event.event_id || `${event.customer_id}-${index}`}
              onClick={() => onSelectEvent(event)}
            >
              <div className="priority-number">
                {String(index + 1).padStart(2, "0")}
              </div>

              <div className="priority-main">
                <div className="priority-customer">
                  {event.customer_id}
                  <Badge type={priorityClass(event.priority)}>
                    {event.priority}
                  </Badge>
                </div>

                <div className="priority-event">
                  {prettyReason(event.event_type)}
                </div>
              </div>

              <div className="priority-action">
                {actionLabel(event.recommended_action)}
              </div>

              <div className="priority-money">{money(event.amount)}</div>

              <div className="probability">
                {percent(event.recovery_probability * 100)}
                <span>probability</span>
              </div>
            </button>
          ))}

          {topCases.length === 0 && (
            <div className="empty-state">No recovery opportunities found.</div>
          )}
        </div>
      </section>

      <section className="pipeline-card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">RECOVERY PIPELINE</div>
            <h2>Decision workflow</h2>
            <p>From risk detection to recovery execution.</p>
          </div>
        </div>

        <div className="pipeline">
          <div className="pipeline-step">
            <div className="pipeline-icon">01</div>
            <strong>Detect</strong>
            <span>Revenue risk identified</span>
          </div>

          <div className="pipeline-line" />

          <div className="pipeline-step">
            <div className="pipeline-icon">02</div>
            <strong>Score</strong>
            <span>Risk & recovery probability</span>
          </div>

          <div className="pipeline-line" />

          <div className="pipeline-step">
            <div className="pipeline-icon">03</div>
            <strong>Decide</strong>
            <span>AI intervention selected</span>
          </div>

          <div className="pipeline-line" />

          <div className="pipeline-step">
            <div className="pipeline-icon">04</div>
            <strong>Guardrail</strong>
            <span>Bounded action verified</span>
          </div>

          <div className="pipeline-line" />

          <div className="pipeline-step">
            <div className="pipeline-icon">05</div>
            <strong>Recover</strong>
            <span>Outcome recorded</span>
          </div>
        </div>
      </section>
    </>
  );
}

function Queue({ events, onSelectEvent }) {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return events
      .filter((event) => {
        const matchesSearch =
          !query ||
          event.customer_id.toLowerCase().includes(query) ||
          event.event_id.toLowerCase().includes(query) ||
          event.failure_reason.toLowerCase().includes(query);

        const matchesPriority =
          priority === "ALL" || event.priority === priority;

        const matchesStatus =
          status === "ALL" || event.action_status === status;

        return matchesSearch && matchesPriority && matchesStatus;
      })
      .sort((a, b) => b.amount - a.amount);
  }, [events, search, priority, status]);

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">AI OPERATIONS / RECOVERY QUEUE</div>
          <h1>Recovery Queue</h1>
          <p>
            Review every revenue recovery opportunity detected by the agent.
          </p>
        </div>

        <div className="count-pill">{events.length} cases</div>
      </header>

      <div className="filters">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer, event or failure reason..."
        />

        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="ALL">All priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="executed">Executed</option>
          <option value="escalated">Escalated</option>
          <option value="stopped">Stopped</option>
        </select>
      </div>

      <div className="table-card">
        <div className="table-top">
          <span>
            Showing <b>{filtered.length}</b> of <b>{events.length}</b> cases
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Event</th>
                <th>Amount</th>
                <th>Risk</th>
                <th>Recovery probability</th>
                <th>Priority</th>
                <th>AI action</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((event) => (
                <tr
                  key={event.event_id}
                  onClick={() => onSelectEvent(event)}
                  className="clickable-row"
                >
                  <td>
                    <strong>{event.customer_id}</strong>
                    <small>{event.event_id}</small>
                  </td>

                  <td>
                    <strong>{prettyReason(event.event_type)}</strong>
                    <small>{prettyReason(event.failure_reason)}</small>
                  </td>

                  <td className="amount-cell">{moneyFull(event.amount)}</td>

                  <td>{event.risk_score.toFixed(1)}</td>

                  <td>
                    <div className="prob-bar">
                      <div
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, event.recovery_probability * 100)
                          )}%`,
                        }}
                      />
                    </div>
                    {percent(event.recovery_probability * 100)}
                  </td>

                  <td>
                    <Badge type={priorityClass(event.priority)}>
                      {event.priority}
                    </Badge>
                  </td>

                  <td>{actionLabel(event.recommended_action)}</td>

                  <td>
                    <Badge type={String(event.action_status).toLowerCase()}>
                      {statusLabel(event.action_status)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">No cases match the selected filters.</div>
        )}
      </div>
    </>
  );
}

function Strategy({ events }) {
  const counts = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        if (event.action_status === "executed") acc.executed++;
        if (event.action_status === "escalated") acc.escalated++;
        if (event.action_status === "stopped") acc.stopped++;

        return acc;
      },
      { executed: 0, escalated: 0, stopped: 0 }
    );
  }, [events]);

  const totalSelected = events
    .filter(
      (e) =>
        e.action_status === "executed" || e.action_status === "escalated"
    )
    .reduce((sum, e) => sum + e.amount, 0);

  const totalRecovered = events.reduce(
    (sum, e) => sum + e.recovered_amount,
    0
  );

  const strategyData = [
    { name: "Executed", value: counts.executed },
    { name: "Escalated", value: counts.escalated },
    { name: "Stopped", value: counts.stopped },
  ];

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">AI OPERATIONS / STRATEGY</div>
          <h1>Strategy Simulator</h1>
          <p>
            Evaluate the recovery policy using the complete recovery dataset.
          </p>
        </div>
      </header>

      <section className="strategy-hero">
        <div>
          <div className="eyebrow">CURRENT POLICY</div>
          <h2>Bounded AI recovery strategy</h2>
          <p>
            The agent evaluates risk, recovery probability, retry history and
            guardrail conditions before selecting an action.
          </p>
        </div>

        <div className="strategy-value">{money(totalSelected)}</div>
      </section>

      <div className="strategy-grid">
        <div className="strategy-card">
          <span>CASES EVALUATED</span>
          <strong>{events.length}</strong>
          <small>Complete dataset</small>
        </div>

        <div className="strategy-card">
          <span>EXECUTED</span>
          <strong>{counts.executed}</strong>
          <small>Recovery attempts</small>
        </div>

        <div className="strategy-card">
          <span>ESCALATED</span>
          <strong>{counts.escalated}</strong>
          <small>Human review</small>
        </div>

        <div className="strategy-card">
          <span>STOPPED</span>
          <strong>{counts.stopped}</strong>
          <small>Guardrail/low-value stop</small>
        </div>
      </div>

      <section className="chart-card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">POLICY OUTCOME</div>
            <h2>Recovery decision distribution</h2>
          </div>
        </div>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={strategyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#202631" />
              <XAxis dataKey="name" stroke="#7e899c" />
              <YAxis stroke="#7e899c" />
              <Tooltip
                contentStyle={{
                  background: "#11151d",
                  border: "1px solid #29313d",
                  borderRadius: 10,
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="comparison-card">
        <div>
          <div className="eyebrow">RECOVERY OUTCOME</div>
          <h2>Selected value vs confirmed recovery</h2>
          <p>
            These figures are calculated from the actual events returned by the
            backend.
          </p>
        </div>

        <div className="comparison-values">
          <div>
            <span>Selected / attempted value</span>
            <strong>{money(totalSelected)}</strong>
          </div>

          <div>
            <span>Confirmed recovered</span>
            <strong className="green-text">{money(totalRecovered)}</strong>
          </div>
        </div>
      </section>
    </>
  );
}

function Audit({ events }) {
  const overrides = events.filter(
    (event) =>
      event.action_status === "escalated" ||
      event.recommended_action === "escalate_to_human"
  ).length;

  const executed = events.filter(
    (event) => event.action_status === "executed"
  ).length;

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">AI OPERATIONS / GOVERNANCE</div>
          <h1>Audit & Guardrails</h1>
          <p>
            Inspect bounded decisions and human-approval escalation paths.
          </p>
        </div>
      </header>

      <div className="audit-summary">
        <div className="audit-stat">
          <span>TOTAL EVENTS</span>
          <strong>{events.length}</strong>
        </div>

        <div className="audit-stat amber">
          <span>ESCALATED</span>
          <strong>{overrides}</strong>
        </div>

        <div className="audit-stat green">
          <span>EXECUTED</span>
          <strong>{executed}</strong>
        </div>
      </div>

      <section className="guardrail-card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">GUARDRAIL MONITOR</div>
            <h2>Decision safety controls</h2>
          </div>
        </div>

        <div className="guardrail-grid">
          <div>
            <span className="guardrail-icon green-bg">✓</span>
            <strong>Bounded actions</strong>
            <p>
              Recovery attempts are restricted to predefined intervention
              types.
            </p>
          </div>

          <div>
            <span className="guardrail-icon amber-bg">!</span>
            <strong>Human escalation</strong>
            <p>
              High-value or uncertain cases can be routed for human approval.
            </p>
          </div>

          <div>
            <span className="guardrail-icon red-bg">×</span>
            <strong>Stop conditions</strong>
            <p>
              Low-confidence or exhausted retry cases are prevented from
              repeated attempts.
            </p>
          </div>
        </div>
      </section>

      <section className="table-card">
        <div className="table-top">
          <div>
            <div className="eyebrow">AUDIT SAMPLE</div>
            <h2>Recent decisions</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Amount</th>
                <th>AI recommendation</th>
                <th>Final status</th>
                <th>Recovery result</th>
                <th>Timestamp</th>
              </tr>
            </thead>

            <tbody>
              {events.slice(0, 25).map((event) => (
                <tr key={event.event_id}>
                  <td>{event.customer_id}</td>
                  <td>{moneyFull(event.amount)}</td>
                  <td>{actionLabel(event.recommended_action)}</td>
                  <td>
                    <Badge type={String(event.action_status).toLowerCase()}>
                      {statusLabel(event.action_status)}
                    </Badge>
                  </td>
                  <td>{prettyReason(event.recovery_result)}</td>
                  <td>{formatDate(event.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Analytics({ events, summary }) {
  const failureData = useMemo(() => {
    const map = {};

    events.forEach((event) => {
      const key = prettyReason(event.failure_reason);

      if (!map[key]) {
        map[key] = {
          reason: key,
          cases: 0,
          revenue: 0,
        };
      }

      map[key].cases++;
      map[key].revenue += event.amount;
    });

    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [events]);

  const priorityData = useMemo(() => {
    const map = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    events.forEach((event) => {
      if (map[event.priority] !== undefined) {
        map[event.priority]++;
      }
    });

    return Object.entries(map).map(([priority, count]) => ({
      priority,
      count,
    }));
  }, [events]);

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">AI OPERATIONS / ANALYTICS</div>
          <h1>Recovery Analytics</h1>
          <p>
            Analyze the complete revenue-risk dataset and recovery outcomes.
          </p>
        </div>
      </header>

      <div className="analytics-kpis">
        <div>
          <span>Total cases</span>
          <strong>{events.length}</strong>
        </div>

        <div>
          <span>Revenue at risk</span>
          <strong>{money(summary.total_at_risk)}</strong>
        </div>

        <div>
          <span>Recovered</span>
          <strong>{money(summary.total_recovered)}</strong>
        </div>

        <div>
          <span>Recovery rate</span>
          <strong>{percent(summary.recovery_rate)}</strong>
        </div>
      </div>

      <div className="analytics-grid">
        <section className="chart-card">
          <div className="section-heading">
            <div>
              <div className="eyebrow">FAILURE ANALYSIS</div>
              <h2>Revenue by failure reason</h2>
            </div>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={failureData}
                layout="vertical"
                margin={{ left: 30, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#202631" />
                <XAxis
                  type="number"
                  stroke="#7e899c"
                  tickFormatter={(v) => money(v)}
                />
                <YAxis
                  type="category"
                  dataKey="reason"
                  width={130}
                  stroke="#7e899c"
                />
                <Tooltip
                  formatter={(value) => moneyFull(value)}
                  contentStyle={{
                    background: "#11151d",
                    border: "1px solid #29313d",
                    borderRadius: 10,
                  }}
                />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-card">
          <div className="section-heading">
            <div>
              <div className="eyebrow">PRIORITY MIX</div>
              <h2>Recovery priority distribution</h2>
            </div>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height={360}>
              <PieChart>
                <Pie
                  data={priorityData}
                  dataKey="count"
                  nameKey="priority"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={65}
                  paddingAngle={4}
                >
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} />
                  ))}
                </Pie>

                <Tooltip
                  contentStyle={{
                    background: "#11151d",
                    border: "1px solid #29313d",
                    borderRadius: 10,
                  }}
                />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="chart-card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">FAILURE TABLE</div>
            <h2>Top revenue leakage reasons</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Failure reason</th>
                <th>Cases</th>
                <th>Revenue exposed</th>
              </tr>
            </thead>

            <tbody>
              {failureData.map((item) => (
                <tr key={item.reason}>
                  <td>{item.reason}</td>
                  <td>{item.cases}</td>
                  <td>{moneyFull(item.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("overview");
  const [summary, setSummary] = useState(FALLBACK_SUMMARY);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);

        const [summaryResponse, eventsResponse] = await Promise.all([
          fetch(`${API_URL}/api/summary`),
          fetch(`${API_URL}/api/events`),
        ]);

        if (!summaryResponse.ok || !eventsResponse.ok) {
          throw new Error("Backend API request failed");
        }

        const summaryData = await summaryResponse.json();
        const eventsData = await eventsResponse.json();

        const rawEvents =
          eventsData.events ||
          eventsData.cases ||
          eventsData.data ||
          (Array.isArray(eventsData) ? eventsData : []);

        const normalizedEvents = Array.isArray(rawEvents)
          ? rawEvents.map(normalizeEvent)
          : [];

        if (!mounted) return;

        setSummary({
          total_at_risk: Number(summaryData.total_at_risk ?? 0),
          total_recoverable: Number(summaryData.total_recoverable ?? 0),
          total_recovered: Number(summaryData.total_recovered ?? 0),
          recovery_rate: Number(summaryData.recovery_rate ?? 0),
          status_breakdown: summaryData.status_breakdown || [],
          priority_breakdown: summaryData.priority_breakdown || [],
          failure_reason_breakdown:
            summaryData.failure_reason_breakdown || [],
        });

        setEvents(normalizedEvents);
        setApiConnected(true);

        console.log("Revenue Recovery API connected");
        console.log("Events loaded:", normalizedEvents.length);
        console.log("Summary:", summaryData);
      } catch (error) {
        console.error("Dashboard API error:", error);

        if (mounted) {
          setApiConnected(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  function renderPage() {
    if (loading && events.length === 0) {
      return (
        <div className="loading-screen">
          <div className="loading-orb" />
          <h2>Loading Revenue Recovery Intelligence</h2>
          <p>Connecting to the recovery engine...</p>
        </div>
      );
    }

    switch (activePage) {
      case "queue":
        return (
          <Queue
            events={events}
            onSelectEvent={setSelectedEvent}
          />
        );

      case "strategy":
        return <Strategy events={events} />;

      case "audit":
        return <Audit events={events} />;

      case "analytics":
        return <Analytics events={events} summary={summary} />;

      default:
        return (
          <Overview
            summary={summary}
            events={events}
            onSelectEvent={setSelectedEvent}
            onNavigate={setActivePage}
            apiConnected={apiConnected}
          />
        );
    }
  }

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        :root {
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          color: #eef2f8;
          background: #07090d;
          font-synthesis: none;
          text-rendering: optimizeLegibility;
        }

        body {
          margin: 0;
          min-width: 320px;
          background:
            radial-gradient(circle at 75% 0%, rgba(82, 62, 180, 0.09), transparent 32%),
            #07090d;
        }

        button,
        input,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .app {
          min-height: 100vh;
          display: flex;
          background:
            radial-gradient(circle at 80% 5%, rgba(78, 67, 170, 0.08), transparent 30%),
            #07090d;
        }

        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: 245px;
          background: rgba(9, 11, 16, 0.97);
          border-right: 1px solid #1b2029;
          padding: 27px 17px 20px;
          display: flex;
          flex-direction: column;
          z-index: 20;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 9px;
          margin-bottom: 39px;
        }

        .brand-logo {
          width: 39px;
          height: 39px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: -1px;
          color: white;
          background: linear-gradient(135deg, #6f58ff, #237bff);
          box-shadow: 0 0 25px rgba(92, 78, 255, 0.25);
        }

        .brand-name {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.2px;
        }

        .brand-sub {
          color: #687285;
          font-size: 10px;
          margin-top: 3px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .nav-title {
          color: #4d5666;
          font-size: 10px;
          letter-spacing: 1.5px;
          font-weight: 700;
          padding: 0 12px;
          margin: 0 0 10px;
        }

        .nav {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .nav-button {
          border: 1px solid transparent;
          background: transparent;
          color: #788294;
          width: 100%;
          padding: 11px 12px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
          font-size: 13px;
          transition: 0.18s ease;
        }

        .nav-button:hover {
          background: #11151c;
          color: #cdd4df;
        }

        .nav-button.active {
          color: #fff;
          background: linear-gradient(
            90deg,
            rgba(95, 77, 255, 0.18),
            rgba(53, 90, 180, 0.08)
          );
          border-color: rgba(102, 91, 255, 0.24);
        }

        .nav-icon {
          width: 18px;
          color: #667187;
          text-align: center;
          font-size: 16px;
        }

        .nav-button.active .nav-icon {
          color: #8b7cff;
        }

        .nav-count {
          margin-left: auto;
          color: #9a8cff;
          background: rgba(111, 88, 255, 0.12);
          border-radius: 20px;
          padding: 2px 7px;
          font-size: 10px;
          font-weight: 700;
        }

        .sidebar-bottom {
          margin-top: auto;
        }

        .system-card {
          border: 1px solid #1d2530;
          background: linear-gradient(145deg, #0d1117, #0b0e13);
          border-radius: 11px;
          padding: 13px;
        }

        .system-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: #9aa4b4;
        }

        .system-row strong {
          color: #e8edf5;
          font-size: 12px;
        }

        .green-dot,
        .live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #3be39b;
          display: inline-block;
          box-shadow: 0 0 10px rgba(59, 227, 155, 0.8);
        }

        .system-sub {
          color: #4f5a6c;
          font-size: 10px;
          margin-top: 9px;
        }

        .version {
          color: #3f4754;
          font-size: 9px;
          text-align: center;
          margin-top: 13px;
          letter-spacing: 0.5px;
        }

        .main {
          width: calc(100% - 245px);
          margin-left: 245px;
          padding: 36px 44px 60px;
          min-height: 100vh;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 16px;
        }

        .eyebrow {
          color: #6f63c9;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.5px;
          margin-bottom: 8px;
        }

        .page-header h1,
        .section-heading h2,
        .strategy-hero h2 {
          margin: 0;
          color: #f4f6fb;
          letter-spacing: -0.7px;
        }

        .page-header h1 {
          font-size: 28px;
          line-height: 1.15;
        }

        .page-header p,
        .section-heading p,
        .strategy-hero p {
          margin: 7px 0 0;
          color: #697385;
          font-size: 12px;
          line-height: 1.6;
        }

        .live-status {
          display: flex;
          align-items: center;
          gap: 7px;
          border: 1px solid rgba(59, 227, 155, 0.2);
          background: rgba(59, 227, 155, 0.05);
          color: #59e7aa;
          border-radius: 7px;
          padding: 8px 11px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .live-data-strip {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #737e91;
          font-size: 10px;
          margin: 4px 0 18px;
        }

        .separator {
          color: #353c48;
        }

        .warning-banner {
          display: flex;
          gap: 10px;
          align-items: center;
          border: 1px solid rgba(245, 166, 35, 0.25);
          background: rgba(245, 166, 35, 0.06);
          color: #d8a34e;
          padding: 10px 13px;
          border-radius: 8px;
          font-size: 11px;
          margin-bottom: 15px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .stat-card {
          position: relative;
          overflow: hidden;
          background: linear-gradient(145deg, #0e1117, #0b0e13);
          border: 1px solid #1b222d;
          border-radius: 11px;
          padding: 18px;
          min-height: 130px;
        }

        .stat-card::after {
          content: "";
          position: absolute;
          width: 80px;
          height: 80px;
          right: -25px;
          bottom: -30px;
          border-radius: 50%;
          filter: blur(22px);
          opacity: 0.17;
        }

        .stat-card.purple::after {
          background: #6d5cff;
        }

        .stat-card.blue::after {
          background: #348bff;
        }

        .stat-card.green::after {
          background: #34d997;
        }

        .stat-card.orange::after {
          background: #f0a23c;
        }

        .stat-label {
          color: #687284;
          font-size: 9px;
          letter-spacing: 1.1px;
          font-weight: 800;
        }

        .stat-value {
          color: #f2f4f8;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -1px;
          margin-top: 10px;
        }

        .stat-description {
          color: #4e5868;
          font-size: 10px;
          margin-top: 7px;
        }

        .ai-impact-card,
        .queue-section,
        .pipeline-card,
        .chart-card,
        .comparison-card,
        .guardrail-card,
        .strategy-hero,
        .table-card {
          background: linear-gradient(145deg, #0d1117, #0a0d12);
          border: 1px solid #1b222d;
          border-radius: 12px;
        }

        .ai-impact-card {
          margin-top: 13px;
          padding: 21px;
        }

        .section-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
        }

        .section-heading h2 {
          font-size: 16px;
        }

        .text-btn {
          border: 0;
          background: transparent;
          color: #8175ff;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 0;
        }

        .text-btn:hover {
          color: #a29aff;
        }

        .impact-grid {
          display: grid;
          grid-template-columns: 1fr 35px 1fr 1fr;
          gap: 12px;
          align-items: stretch;
          margin-top: 20px;
        }

        .policy-panel,
        .additional-panel {
          border: 1px solid #1b222d;
          background: #0a0e13;
          border-radius: 10px;
          padding: 17px;
        }

        .policy-panel.optimized {
          border-color: rgba(89, 114, 255, 0.28);
          background:
            radial-gradient(circle at 100% 0%, rgba(88, 88, 255, 0.12), transparent 40%),
            #0a0e13;
        }

        .policy-label {
          color: #626d7e;
          font-size: 9px;
          letter-spacing: 1.2px;
          font-weight: 800;
        }

        .policy-value {
          color: #e9ecf4;
          font-size: 25px;
          font-weight: 700;
          margin-top: 9px;
        }

        .policy-caption {
          color: #515c6d;
          font-size: 10px;
          margin-top: 4px;
        }

        .mini-status-row {
          display: flex;
          gap: 14px;
          margin-top: 17px;
          color: #687385;
          font-size: 9px;
        }

        .mini-status-row b {
          color: #dce1ea;
          margin-right: 3px;
        }

        .policy-arrow {
          display: grid;
          place-items: center;
          color: #655aff;
          font-size: 20px;
        }

        .optimization-note {
          display: flex;
          gap: 6px;
          color: #5c68bb;
          font-size: 9px;
          margin-top: 16px;
        }

        .additional-value {
          color: #54e5a8;
          font-size: 24px;
          font-weight: 700;
          margin-top: 9px;
        }

        .improvement {
          color: #4cbb91;
          font-size: 10px;
          margin-top: 4px;
        }

        .queue-section {
          margin-top: 13px;
          padding: 21px;
        }

        .priority-list {
          margin-top: 18px;
          display: flex;
          flex-direction: column;
        }

        .priority-row {
          border: 0;
          border-top: 1px solid #181e27;
          background: transparent;
          color: inherit;
          display: grid;
          grid-template-columns: 36px 1.4fr 1fr 110px 115px;
          align-items: center;
          gap: 12px;
          padding: 13px 5px;
          text-align: left;
        }

        .priority-row:hover {
          background: rgba(90, 82, 200, 0.045);
        }

        .priority-number {
          color: #3f4754;
          font-size: 10px;
          font-weight: 800;
        }

        .priority-customer {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #e5e9f0;
          font-size: 11px;
          font-weight: 700;
        }

        .priority-event {
          color: #5d6778;
          font-size: 9px;
          margin-top: 4px;
        }

        .priority-action {
          color: #929cad;
          font-size: 10px;
        }

        .priority-money {
          color: #dfe4ec;
          font-size: 11px;
          font-weight: 700;
          text-align: right;
        }

        .probability {
          color: #71dfb0;
          font-size: 11px;
          font-weight: 700;
          text-align: right;
        }

        .probability span {
          display: block;
          color: #485363;
          font-size: 8px;
          font-weight: 500;
          margin-top: 2px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          border-radius: 5px;
          padding: 3px 6px;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          border: 1px solid transparent;
        }

        .badge.high {
          color: #ff8290;
          background: rgba(255, 79, 98, 0.08);
          border-color: rgba(255, 79, 98, 0.17);
        }

        .badge.medium {
          color: #e8b35c;
          background: rgba(239, 171, 61, 0.08);
          border-color: rgba(239, 171, 61, 0.17);
        }

        .badge.low {
          color: #7893af;
          background: rgba(93, 130, 165, 0.08);
          border-color: rgba(93, 130, 165, 0.17);
        }

        .badge.executed {
          color: #5ce4a8;
          background: rgba(59, 227, 155, 0.08);
          border-color: rgba(59, 227, 155, 0.16);
        }

        .badge.escalated {
          color: #f2b75e;
          background: rgba(242, 183, 94, 0.08);
          border-color: rgba(242, 183, 94, 0.16);
        }

        .badge.stopped {
          color: #a0a8b6;
          background: rgba(130, 140, 155, 0.08);
          border-color: rgba(130, 140, 155, 0.16);
        }

        .pipeline-card {
          margin-top: 13px;
          padding: 21px;
        }

        .pipeline {
          display: flex;
          align-items: center;
          margin-top: 23px;
        }

        .pipeline-step {
          min-width: 115px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 5px;
        }

        .pipeline-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          color: #8e83ff;
          background: rgba(104, 88, 255, 0.08);
          border: 1px solid rgba(104, 88, 255, 0.18);
          font-size: 9px;
          font-weight: 800;
        }

        .pipeline-step strong {
          color: #dce2eb;
          font-size: 10px;
        }

        .pipeline-step span {
          color: #4d5868;
          font-size: 8px;
        }

        .pipeline-line {
          height: 1px;
          flex: 1;
          background: #202630;
        }

        .count-pill {
          color: #9b8eff;
          background: rgba(106, 91, 255, 0.09);
          border: 1px solid rgba(106, 91, 255, 0.17);
          padding: 8px 11px;
          border-radius: 7px;
          font-size: 10px;
          font-weight: 700;
        }

        .filters {
          display: flex;
          gap: 10px;
          margin: 20px 0 13px;
        }

        .filters input,
        .filters select {
          border: 1px solid #202731;
          background: #0c1016;
          color: #dce1e9;
          outline: none;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 11px;
        }

        .filters input {
          flex: 1;
          min-width: 200px;
        }

        .filters input:focus,
        .filters select:focus {
          border-color: #5148a7;
        }

        .table-card {
          overflow: hidden;
        }

        .table-top {
          padding: 16px 19px;
          border-bottom: 1px solid #181f28;
          color: #626d7d;
          font-size: 10px;
        }

        .table-top h2 {
          color: #e9edf4;
          margin: 3px 0 0;
          font-size: 15px;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 950px;
        }

        th {
          text-align: left;
          color: #4f5969;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 800;
          padding: 12px 15px;
          background: #0b0f14;
          border-bottom: 1px solid #1a2029;
        }

        td {
          color: #929cac;
          font-size: 10px;
          padding: 13px 15px;
          border-bottom: 1px solid #151b23;
          vertical-align: middle;
        }

        td strong {
          display: block;
          color: #dfe4ec;
          font-size: 10px;
        }

        td small {
          display: block;
          color: #475263;
          font-size: 8px;
          margin-top: 3px;
        }

        .clickable-row {
          cursor: pointer;
        }

        .clickable-row:hover td {
          background: rgba(101, 88, 255, 0.035);
        }

        .amount-cell {
          color: #dce1e9;
          font-weight: 700;
        }

        .prob-bar {
          display: inline-block;
          width: 60px;
          height: 4px;
          background: #202631;
          border-radius: 10px;
          overflow: hidden;
          vertical-align: middle;
          margin-right: 7px;
        }

        .prob-bar div {
          height: 100%;
          background: #54dca5;
          border-radius: inherit;
        }

        .strategy-hero {
          margin-top: 20px;
          padding: 25px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: center;
          background:
            radial-gradient(circle at 80% 20%, rgba(90, 74, 230, 0.14), transparent 40%),
            #0d1117;
        }

        .strategy-hero h2 {
          font-size: 21px;
        }

        .strategy-value {
          color: #9a8cff;
          font-size: 29px;
          font-weight: 800;
          white-space: nowrap;
        }

        .strategy-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 13px;
        }

        .strategy-card,
        .audit-stat,
        .analytics-kpis > div {
          border: 1px solid #1b222d;
          background: #0d1117;
          border-radius: 10px;
          padding: 17px;
        }

        .strategy-card span,
        .audit-stat span,
        .analytics-kpis span {
          display: block;
          color: #5f6979;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .strategy-card strong,
        .audit-stat strong,
        .analytics-kpis strong {
          display: block;
          color: #e8ecf3;
          font-size: 24px;
          margin-top: 8px;
        }

        .strategy-card small {
          color: #485363;
          display: block;
          font-size: 9px;
          margin-top: 5px;
        }

        .chart-card {
          padding: 20px;
          margin-top: 13px;
        }

        .chart-container {
          width: 100%;
          height: 320px;
          margin-top: 12px;
        }

        .comparison-card {
          margin-top: 13px;
          padding: 22px;
          display: flex;
          justify-content: space-between;
          gap: 30px;
          align-items: center;
        }

        .comparison-values {
          display: flex;
          gap: 40px;
        }

        .comparison-values span {
          display: block;
          color: #566173;
          font-size: 9px;
        }

        .comparison-values strong {
          display: block;
          color: #dce1ea;
          font-size: 21px;
          margin-top: 7px;
        }

        .green-text {
          color: #53dfa6 !important;
        }

        .audit-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 20px;
        }

        .audit-stat.amber strong {
          color: #e9b15b;
        }

        .audit-stat.green strong {
          color: #52dba3;
        }

        .guardrail-card {
          padding: 21px;
          margin-top: 13px;
        }

        .guardrail-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 20px;
        }

        .guardrail-grid > div {
          border: 1px solid #1b222d;
          border-radius: 10px;
          padding: 17px;
          background: #0a0e13;
        }

        .guardrail-icon {
          width: 31px;
          height: 31px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          margin-bottom: 12px;
          font-weight: 800;
        }

        .green-bg {
          color: #52dfa6;
          background: rgba(59, 227, 155, 0.08);
        }

        .amber-bg {
          color: #efb35d;
          background: rgba(239, 179, 93, 0.08);
        }

        .red-bg {
          color: #ff7687;
          background: rgba(255, 85, 105, 0.08);
        }

        .guardrail-grid strong {
          display: block;
          color: #dfe4ec;
          font-size: 11px;
        }

        .guardrail-grid p {
          color: #566173;
          font-size: 9px;
          line-height: 1.6;
          margin: 7px 0 0;
        }

        .analytics-kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 20px;
        }

        .analytics-kpis strong {
          color: #f0f3f8;
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 13px;
        }

        .analytics-grid .chart-card {
          min-width: 0;
        }

        .empty-state {
          padding: 35px;
          color: #566173;
          text-align: center;
          font-size: 11px;
        }

        .loading-screen {
          min-height: 70vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #6b7586;
        }

        .loading-screen h2 {
          color: #dfe4ec;
          font-size: 15px;
          margin: 20px 0 4px;
        }

        .loading-screen p {
          font-size: 10px;
        }

        .loading-orb {
          width: 42px;
          height: 42px;
          border: 2px solid #262c37;
          border-top-color: #7164ff;
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.76);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 100;
        }

        .modal {
          width: min(760px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          border: 1px solid #292f3b;
          border-radius: 14px;
          background: #0c1016;
          box-shadow: 0 30px 100px rgba(0, 0, 0, 0.55);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          padding: 22px;
          border-bottom: 1px solid #1b222d;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 20px;
          color: #eef2f8;
        }

        .muted {
          color: #4c5667;
          font-size: 9px;
          margin-top: 5px;
        }

        .close-btn {
          border: 1px solid #252c37;
          background: #11151c;
          color: #7e899a;
          width: 31px;
          height: 31px;
          border-radius: 7px;
          font-size: 19px;
        }

        .modal-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 9px;
          padding: 18px 22px 0;
        }

        .detail-card {
          background: #0a0e13;
          border: 1px solid #1b222d;
          border-radius: 8px;
          padding: 12px;
        }

        .detail-card span,
        .info-grid span,
        .decision-box span,
        .diagnosis span {
          display: block;
          color: #566173;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        .detail-card strong {
          display: block;
          color: #e4e9f1;
          font-size: 14px;
          margin-top: 7px;
        }

        .modal-section {
          padding: 19px 22px 0;
        }

        .modal-section h3 {
          color: #dce1e9;
          font-size: 12px;
          margin: 0 0 11px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 11px;
        }

        .info-grid > div {
          padding: 10px;
          border: 1px solid #171e27;
          border-radius: 7px;
        }

        .info-grid strong {
          display: block;
          color: #cbd2dc;
          font-size: 10px;
          margin-top: 5px;
        }

        .decision-box {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .decision-box > div {
          padding: 12px;
          background: #0a0e13;
          border: 1px solid #1a212a;
          border-radius: 8px;
        }

        .decision-box strong {
          display: block;
          color: #dce2ea;
          font-size: 11px;
          margin-top: 5px;
        }

        .diagnosis {
          margin-top: 10px;
          padding: 12px;
          background: #0a0e13;
          border: 1px solid #1a212a;
          border-radius: 8px;
        }

        .diagnosis p {
          color: #7d8797;
          font-size: 10px;
          line-height: 1.6;
          margin: 7px 0 0;
        }

        .modal-footer {
          padding: 20px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #4d5868;
          font-size: 9px;
        }

        .primary-btn {
          border: 0;
          color: white;
          background: linear-gradient(135deg, #6558ef, #416bdc);
          border-radius: 7px;
          padding: 8px 14px;
          font-size: 10px;
          font-weight: 700;
        }

        @media (max-width: 1100px) {
          .main {
            padding: 30px 25px;
          }

          .stats-grid,
          .strategy-grid,
          .analytics-kpis {
            grid-template-columns: repeat(2, 1fr);
          }

          .impact-grid {
            grid-template-columns: 1fr 1fr;
          }

          .policy-arrow {
            display: none;
          }

          .additional-panel {
            grid-column: span 2;
          }

          .analytics-grid {
            grid-template-columns: 1fr;
          }

          .pipeline {
            overflow-x: auto;
            padding-bottom: 8px;
          }
        }

        @media (max-width: 780px) {
          .sidebar {
            width: 70px;
            padding: 20px 8px;
          }

          .brand {
            justify-content: center;
            padding: 0;
          }

          .brand-name,
          .brand-sub,
          .nav-title,
          .sidebar-bottom,
          .nav-button span:not(.nav-icon),
          .nav-count {
            display: none;
          }

          .brand-logo {
            width: 40px;
          }

          .nav-button {
            justify-content: center;
            padding: 12px 5px;
          }

          .main {
            width: calc(100% - 70px);
            margin-left: 70px;
            padding: 24px 14px 45px;
          }

          .page-header {
            flex-direction: column;
          }

          .stats-grid,
          .strategy-grid,
          .analytics-kpis,
          .audit-summary,
          .guardrail-grid {
            grid-template-columns: 1fr;
          }

          .impact-grid {
            grid-template-columns: 1fr;
          }

          .additional-panel {
            grid-column: auto;
          }

          .priority-row {
            grid-template-columns: 30px 1fr 90px;
          }

          .priority-action,
          .priority-money {
            display: none;
          }

          .comparison-card {
            flex-direction: column;
            align-items: flex-start;
          }

          .filters {
            flex-direction: column;
          }

          .modal-grid,
          .info-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .decision-box {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-logo">RR</div>

            <div>
              <div className="brand-name">Revenue Recovery</div>
              <div className="brand-sub">AI Agent</div>
            </div>
          </div>

          <div className="nav-title">AI OPERATIONS</div>

          <nav className="nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`nav-button ${
                  activePage === item.id ? "active" : ""
                }`}
                onClick={() => setActivePage(item.id)}
              >
                <Icon>{item.icon}</Icon>
                <span>{item.label}</span>

                {item.id === "queue" && (
                  <span className="nav-count">{events.length}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <div className="system-card">
              <div className="system-row">
                <span className="green-dot" />
                <strong>System operational</strong>
              </div>

              <div className="system-sub">
                AI agent {apiConnected ? "online" : "standby"}
              </div>
            </div>

            <div className="version">Revenue Recovery v1.0</div>
          </div>
        </aside>

        <main className="main">{renderPage()}</main>

        <Modal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      </div>
    </>
  );
}