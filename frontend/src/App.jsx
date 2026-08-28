import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const API_URL = "http://127.0.0.1:8000";

const fallbackCases = [
  {
    id: "63b5ed6d",
    customer_id: "CUST5813",
    issue_type: "Subscription Failed",
    amount: 72065.56,
    recovery_probability: 0.60,
    ai_decision: "Suggest Alternate Method",
    guardrail: "approved",
    status: "executed",
    reasoning:
      "Customer has a strong recovery probability and an alternate payment method can be suggested safely.",
  },
  {
    id: "91ac72ef",
    customer_id: "CUST2048",
    issue_type: "Payment Failed",
    amount: 58420.35,
    recovery_probability: 0.56,
    ai_decision: "Retry Payment",
    guardrail: "approved",
    status: "executed",
    reasoning:
      "A payment retry is appropriate because the failure appears temporary and the customer has good recovery potential.",
  },
  {
    id: "44fd81aa",
    customer_id: "CUST7741",
    issue_type: "Subscription Expired",
    amount: 49680.25,
    recovery_probability: 0.51,
    ai_decision: "Send Reminder",
    guardrail: "approved",
    status: "executed",
    reasoning:
      "A reminder is a low-risk intervention with reasonable recovery potential.",
  },
  {
    id: "72bc91de",
    customer_id: "CUST3490",
    issue_type: "Payment Failed",
    amount: 42150.8,
    recovery_probability: 0.44,
    ai_decision: "Retry Payment",
    guardrail: "overridden",
    status: "escalated",
    reasoning:
      "The AI recommendation was modified by policy guardrails because repeated retries could create customer friction.",
  },
  {
    id: "18ae45cd",
    customer_id: "CUST9122",
    issue_type: "Subscription Failed",
    amount: 38940.4,
    recovery_probability: 0.39,
    ai_decision: "Stop Attempts",
    guardrail: "overridden",
    status: "stopped",
    reasoning:
      "The AI suggested continuing recovery, but guardrails stopped the action because the attempt threshold was exceeded.",
  },
];

const priorityQueue = [
  fallbackCases[0],
  fallbackCases[1],
  fallbackCases[2],
  fallbackCases[3],
  fallbackCases[4],
];

const auditTrail = [
  {
    title: "Revenue risk detected",
    text: "Transaction failure identified and revenue exposure calculated.",
  },
  {
    title: "AI decision generated",
    text: "Recovery probability and customer context evaluated by the AI decision engine.",
  },
  {
    title: "Guardrail evaluated",
    text: "Decision checked against recovery policy and safety constraints.",
  },
  {
    title: "Action executed",
    text: "Approved recovery intervention passed to the execution workflow.",
  },
];

const chartData = [
  { name: "Executed", current: 33, optimized: 52 },
  { name: "Escalated", current: 34, optimized: 12 },
  { name: "Stopped", current: 33, optimized: 36 },
];

const pieData = [
  { name: "Approved", value: 76 },
  { name: "Overridden", value: 24 },
];

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function formatLakh(value) {
  return `₹${(Number(value || 0) / 100000).toFixed(2)}L`;
}

function App() {
  const [activePage, setActivePage] = useState("overview");
  const [selectedCase, setSelectedCase] = useState(null);
  const [cases, setCases] = useState(fallbackCases);
  const [apiConnected, setApiConnected] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [summary, setSummary] = useState({
    total_risk: 3590080.21,
    selected_revenue: 942047,
    recovered_revenue: 340921.86,
    recovery_rate: 36.2,
  });

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch(`${API_URL}/summary`);

        if (!response.ok) {
          throw new Error("API unavailable");
        }

        const data = await response.json();

        setApiConnected(true);

        setSummary({
          total_risk:
            data.total_revenue_at_risk ??
            data.total_risk ??
            3590080.21,

          selected_revenue:
            data.revenue_selected_for_recovery ??
            data.selected_revenue ??
            942047,

          recovered_revenue:
            data.revenue_successfully_recovered ??
            data.recovered_revenue ??
            340921.86,

          recovery_rate:
            data.recovery_rate ??
            36.2,
        });

        if (Array.isArray(data.cases)) {
          setCases(data.cases);
        }
      } catch (error) {
        setApiConnected(false);
      }
    }

    loadDashboard();
  }, []);

  const filteredCases = useMemo(() => {
    let result = cases;

    if (filter !== "all") {
      result = result.filter(
        (item) => item.status?.toLowerCase() === filter
      );
    }

    if (search.trim()) {
      const value = search.toLowerCase();

      result = result.filter(
        (item) =>
          String(item.customer_id || "")
            .toLowerCase()
            .includes(value) ||
          String(item.issue_type || "")
            .toLowerCase()
            .includes(value) ||
          String(item.id || "")
            .toLowerCase()
            .includes(value)
      );
    }

    return result;
  }, [cases, filter, search]);

  const openCase = (item) => {
    setSelectedCase(item);
  };

  return (
    <>
      <style>{styles}</style>

      <div className="app-shell">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div>
            <div className="sidebar-brand">
              <div className="brand-symbol">RR</div>

              <div>
                <div className="brand-name">Revenue Recovery</div>
                <div className="brand-caption">AI OPERATIONS</div>
              </div>
            </div>

            <div className="sidebar-divider" />

            <div className="nav-label">WORKSPACE</div>

            <button
              className={`nav-item ${
                activePage === "overview" ? "active" : ""
              }`}
              onClick={() => setActivePage("overview")}
            >
              <span className="nav-icon">⌂</span>
              <span>Overview</span>
            </button>

            <button
              className={`nav-item ${
                activePage === "queue" ? "active" : ""
              }`}
              onClick={() => setActivePage("queue")}
            >
              <span className="nav-icon">☷</span>
              <span>Recovery Queue</span>
              <span className="nav-count">100</span>
            </button>

            <button
              className={`nav-item ${
                activePage === "strategy" ? "active" : ""
              }`}
              onClick={() => setActivePage("strategy")}
            >
              <span className="nav-icon">↗</span>
              <span>Strategy Simulator</span>
            </button>

            <button
              className={`nav-item ${
                activePage === "audit" ? "active" : ""
              }`}
              onClick={() => setActivePage("audit")}
            >
              <span className="nav-icon">◇</span>
              <span>Audit &amp; Guardrails</span>
            </button>

            <button
              className={`nav-item ${
                activePage === "analytics" ? "active" : ""
              }`}
              onClick={() => setActivePage("analytics")}
            >
              <span className="nav-icon">▥</span>
              <span>Analytics</span>
            </button>
          </div>

          <div className="sidebar-bottom">
            <div className="system-card">
              <div className="system-indicator">
                <span className="status-dot" />
              </div>

              <div>
                <strong>System operational</strong>
                <small>AI agent online</small>
              </div>
            </div>

            <div className="version">Revenue Recovery v1.0</div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main-content">
          {activePage === "overview" && (
            <Overview
              summary={summary}
              apiConnected={apiConnected}
              priorityQueue={priorityQueue}
              onOpenCase={openCase}
            />
          )}

          {activePage === "queue" && (
            <QueuePage
              cases={filteredCases}
              filter={filter}
              setFilter={setFilter}
              search={search}
              setSearch={setSearch}
              onOpenCase={openCase}
            />
          )}

          {activePage === "strategy" && <StrategyPage />}

          {activePage === "audit" && <AuditPage />}

          {activePage === "analytics" && <AnalyticsPage />}
        </main>
      </div>

      {selectedCase && (
        <CaseModal
          item={selectedCase}
          onClose={() => setSelectedCase(null)}
        />
      )}
    </>
  );
}

/* =========================================================
   OVERVIEW
   ========================================================= */

function Overview({
  summary,
  apiConnected,
  priorityQueue,
  onOpenCase,
}) {
  const currentPolicy = 430843;
  const optimizedPolicy = 976798;
  const additionalRecovery = optimizedPolicy - currentPolicy;

  return (
    <>
      <header className="main-header">
        <div className="header-copy">
          <div className="breadcrumb">
            AI OPERATIONS <span>/</span> OVERVIEW
          </div>

          <h1>Recovery Analysis</h1>

          <p>
            Monitor exposed revenue and the actions being taken to recover it.
          </p>
        </div>

        <div className="header-status">
          <div className="live-pill">
            <span className="live-dot" />
            LIVE
          </div>

          <div className="connection-status">
            {apiConnected
              ? "Live · FastAPI connected"
              : "Live · Demo data active"}
          </div>
        </div>
      </header>

      {/* METRICS */}
      <section className="metric-grid">
        <MetricCard
          type="risk"
          label="REVENUE AT RISK"
          value={formatLakh(summary.total_risk)}
          description="Total exposed revenue"
        />

        <MetricCard
          type="selected"
          label="SELECTED FOR RECOVERY"
          value={formatLakh(summary.selected_revenue)}
          description="AI-approved opportunities"
        />

        <MetricCard
          type="recovered"
          label="REVENUE RECOVERED"
          value={formatLakh(summary.recovered_revenue)}
          description="Confirmed recovered revenue"
        />

        <MetricCard
          type="rate"
          label="RECOVERY RATE"
          value={`${Number(summary.recovery_rate).toFixed(1)}%`}
          description="Of selected revenue"
        />
      </section>

      {/* AI IMPACT */}
      <section className="impact-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">AI IMPACT</div>
            <h2>Recovery policy optimization</h2>

            <p className="heading-description">
              Estimated revenue impact from AI-driven intervention selection.
            </p>
          </div>

          <button className="text-button">View simulator →</button>
        </div>

        <div className="impact-content">
          <div className="policy-block">
            <span className="policy-label">CURRENT POLICY</span>

            <strong>{formatCurrency(currentPolicy)}</strong>

            <small>Expected recovered revenue</small>

            <div className="policy-stats">
              <span>
                <b>33</b>
                Executed
              </span>

              <span>
                <b>34</b>
                Escalated
              </span>

              <span>
                <b>33</b>
                Stopped
              </span>
            </div>
          </div>

          <div className="optimization-divider">
            <div className="optimization-line" />

            <div className="optimization-badge">
              AI OPTIMIZATION
            </div>

            <div className="optimization-line" />
          </div>

          <div className="policy-block optimized">
            <span className="optimized-label">AI-OPTIMIZED POLICY</span>

            <strong>{formatCurrency(optimizedPolicy)}</strong>

            <small>Expected recovered revenue</small>

            <div className="policy-stats">
              <span>
                <b>52</b>
                Executed
              </span>

              <span>
                <b>12</b>
                Escalated
              </span>

              <span>
                <b>36</b>
                Stopped
              </span>
            </div>
          </div>

          <div className="impact-result">
            <span>ADDITIONAL RECOVERY</span>

            <strong>+{formatCurrency(additionalRecovery)}</strong>

            <small>126.7% potential improvement</small>
          </div>
        </div>
      </section>

      {/* TWO COLUMN */}
      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">PRIORITY QUEUE</div>

              <h2>Recovery opportunities</h2>

              <p className="heading-description">
                Highest-value cases recommended by the AI.
              </p>
            </div>

            <button className="text-button">View all →</button>
          </div>

          <div className="opportunity-list">
            {priorityQueue.map((item, index) => (
              <div
                className="opportunity"
                key={item.id}
                onClick={() => onOpenCase(item)}
              >
                <div className="opportunity-rank">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div>
                  <div className="opportunity-top">
                    <strong>{item.customer_id}</strong>

                    <span
                      className={`priority ${
                        item.recovery_probability >= 0.5
                          ? "high"
                          : item.recovery_probability >= 0.4
                          ? "medium"
                          : "low"
                      }`}
                    >
                      {item.recovery_probability >= 0.5
                        ? "HIGH"
                        : item.recovery_probability >= 0.4
                        ? "MEDIUM"
                        : "LOW"}
                    </span>
                  </div>

                  <div className="opportunity-type">
                    {item.issue_type}
                  </div>

                  <div className="opportunity-action">
                    {item.ai_decision}
                  </div>
                </div>

                <div className="opportunity-value">
                  <strong>{formatCurrency(item.amount)}</strong>

                  <span>
                    {Math.round(item.recovery_probability * 100)}% probability
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">RECOVERY PIPELINE</div>

              <h2>Decision workflow</h2>

              <p className="heading-description">
                From risk detection to recovery execution.
              </p>
            </div>
          </div>

          <div className="pipeline">
            <PipelineStep number="01" title="Detect" text="Risk" />

            <div className="pipeline-connector" />

            <PipelineStep number="02" title="Score" text="Probability" />

            <div className="pipeline-connector" />

            <PipelineStep number="03" title="Decide" text="AI action" />

            <div className="pipeline-connector" />

            <PipelineStep number="04" title="Recover" text="Execute" />
          </div>

          <div className="pipeline-footer">
            <div>
              <span>Cases evaluated</span>
              <strong>100</strong>
            </div>

            <div>
              <span>Recovery selected</span>
              <strong>₹9.42L</strong>
            </div>
          </div>
        </div>
      </section>

      {/* TABLE */}
      <section className="panel cases-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">RECOVERY CASES</div>

            <h2>Recent recovery decisions</h2>

            <p className="heading-description">
              AI decisions, guardrails and execution status.
            </p>
          </div>

          <button className="text-button">View queue →</button>
        </div>

        <div className="table-wrap">
          <table className="case-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Issue</th>
                <th>Amount</th>
                <th>Probability</th>
                <th>AI Decision</th>
                <th>Guardrail</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {priorityQueue.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onOpenCase(item)}
                >
                  <td>
                    <strong>{item.customer_id}</strong>
                  </td>

                  <td>{item.issue_type}</td>

                  <td className="amount">
                    {formatCurrency(item.amount)}
                  </td>

                  <td>
                    {Math.round(item.recovery_probability * 100)}%
                  </td>

                  <td>{item.ai_decision}</td>

                  <td>
                    <span
                      className={`guardrail ${item.guardrail}`}
                    >
                      {item.guardrail === "approved"
                        ? "✓ Approved"
                        : "↺ Overridden"}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`status ${item.status}`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* =========================================================
   METRIC CARD
   ========================================================= */

function MetricCard({ type, label, value, description }) {
  return (
    <div className={`metric-card ${type}`}>
      <div className="metric-top">
        <span className="metric-label">{label}</span>

        <span className="metric-accent" />
      </div>

      <div className="metric-value">{value}</div>

      <div className="metric-description">{description}</div>
    </div>
  );
}

/* =========================================================
   PIPELINE
   ========================================================= */

function PipelineStep({ number, title, text }) {
  return (
    <div className="pipeline-step">
      <div className="pipeline-number">{number}</div>

      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

/* =========================================================
   QUEUE
   ========================================================= */

function QueuePage({
  cases,
  filter,
  setFilter,
  search,
  setSearch,
  onOpenCase,
}) {
  return (
    <>
      <header className="main-header">
        <div className="header-copy">
          <div className="breadcrumb">
            AI OPERATIONS <span>/</span> RECOVERY QUEUE
          </div>

          <h1>Recovery Queue</h1>

          <p>
            Review revenue opportunities prioritized by the AI recovery engine.
          </p>
        </div>

        <div className="header-status">
          <div className="live-pill">
            <span className="live-dot" />
            LIVE
          </div>

          <div className="connection-status">
            100 recovery cases
          </div>
        </div>
      </header>

      <section className="panel full-panel">
        <div className="queue-toolbar">
          <div className="filters">
            {["all", "executed", "escalated", "stopped"].map(
              (item) => (
                <button
                  key={item}
                  className={`filter ${
                    filter === item ? "active" : ""
                  }`}
                  onClick={() => setFilter(item)}
                >
                  {item === "all"
                    ? "All"
                    : item.charAt(0).toUpperCase() + item.slice(1)}
                </button>
              )
            )}
          </div>

          <input
            className="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, issue or case..."
          />
        </div>

        <div className="table-wrap">
          <table className="case-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Issue</th>
                <th>Amount</th>
                <th>Recovery Prob.</th>
                <th>AI Decision</th>
                <th>Guardrail</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty">
                    No recovery cases found.
                  </td>
                </tr>
              ) : (
                cases.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onOpenCase(item)}
                  >
                    <td>
                      <strong>{item.customer_id}</strong>
                    </td>

                    <td>{item.issue_type}</td>

                    <td className="amount">
                      {formatCurrency(item.amount)}
                    </td>

                    <td>
                      {Math.round(item.recovery_probability * 100)}%
                    </td>

                    <td>{item.ai_decision}</td>

                    <td>
                      <span
                        className={`guardrail ${item.guardrail}`}
                      >
                        {item.guardrail === "approved"
                          ? "✓ Approved"
                          : "↺ Overridden"}
                      </span>
                    </td>

                    <td>
                      <span className={`status ${item.status}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* =========================================================
   STRATEGY
   ========================================================= */

function StrategyPage() {
  return (
    <>
      <header className="main-header">
        <div className="header-copy">
          <div className="breadcrumb">
            AI OPERATIONS <span>/</span> STRATEGY
          </div>

          <h1>Strategy Simulator</h1>

          <p>
            Compare rule-based recovery against AI-optimized decisioning.
          </p>
        </div>
      </header>

      <section className="panel full-panel">
        <div className="strategy-hero">
          <div className="strategy-side">
            <span>CURRENT POLICY</span>

            <strong>₹4.31L</strong>

            <small>Expected recovered revenue</small>

            <div className="strategy-counts">
              <div>
                <b>33</b>
                <span>Executed</span>
              </div>

              <div>
                <b>34</b>
                <span>Escalated</span>
              </div>

              <div>
                <b>33</b>
                <span>Stopped</span>
              </div>
            </div>
          </div>

          <div className="strategy-middle">
            <span>AI OPTIMIZATION</span>

            <strong>+₹5.46L</strong>

            <small>Potential additional recovery</small>
          </div>

          <div className="strategy-side ai">
            <span>AI-OPTIMIZED POLICY</span>

            <strong>₹9.77L</strong>

            <small>Expected recovered revenue</small>

            <div className="strategy-counts">
              <div>
                <b>52</b>
                <span>Executed</span>
              </div>

              <div>
                <b>12</b>
                <span>Escalated</span>
              </div>

              <div>
                <b>36</b>
                <span>Stopped</span>
              </div>
            </div>

            <div className="ai-policy-label">
              AI POLICY
            </div>
          </div>
        </div>

        <div className="strategy-explanation">
          <div className="eyebrow">DECISIONING</div>

          <h2>AI-driven recovery optimization</h2>

          <p>
            The AI evaluates revenue exposure, recovery probability and
            intervention suitability before recommending a bounded recovery
            action. Guardrails independently validate the recommendation
            before execution.
          </p>
        </div>
      </section>
    </>
  );
}

/* =========================================================
   AUDIT
   ========================================================= */

function AuditPage() {
  return (
    <>
      <header className="main-header">
        <div className="header-copy">
          <div className="breadcrumb">
            AI OPERATIONS <span>/</span> AUDIT
          </div>

          <h1>Audit &amp; Guardrails</h1>

          <p>
            Monitor AI decisions and the policy controls applied before action.
          </p>
        </div>
      </header>

      <section className="panel full-panel">
        <div className="audit-summary">
          <div className="audit-stat">
            <span>Total decisions</span>
            <strong>100</strong>
          </div>

          <div className="audit-stat">
            <span>Approved</span>
            <strong>76</strong>
          </div>

          <div className="audit-stat warning">
            <span>Overridden</span>
            <strong>24</strong>
          </div>

          <div className="audit-stat">
            <span>Audit coverage</span>
            <strong>100%</strong>
          </div>
        </div>

        <div className="audit-message">
          <div className="audit-symbol">✓</div>

          <div>
            <strong>Guardrails actively protecting recovery workflows</strong>

            <p>
              Policy controls review AI recommendations before actions are
              executed, preventing unsafe or inappropriate recovery attempts.
            </p>
          </div>
        </div>

        <div className="panel-subheading">
          Guardrail outcome
        </div>

        <div className="table-wrap">
          <table className="case-table">
            <thead>
              <tr>
                <th>Decision</th>
                <th>Count</th>
                <th>Share</th>
                <th>Outcome</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>
                  <strong>Approved</strong>
                </td>

                <td>76</td>

                <td>76%</td>

                <td>
                  <span className="guardrail approved">
                    ✓ Allowed
                  </span>
                </td>
              </tr>

              <tr>
                <td>
                  <strong>Overridden</strong>
                </td>

                <td>24</td>

                <td>24%</td>

                <td>
                  <span className="guardrail overridden">
                    ↺ Corrected
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* =========================================================
   ANALYTICS
   ========================================================= */

function AnalyticsPage() {
  return (
    <>
      <header className="main-header">
        <div className="header-copy">
          <div className="breadcrumb">
            AI OPERATIONS <span>/</span> ANALYTICS
          </div>

          <h1>Recovery Analytics</h1>

          <p>
            Understand recovery outcomes and AI decision performance.
          </p>
        </div>
      </header>

      <section className="charts-grid">
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">POLICY COMPARISON</div>

              <h2>Recovery workflow outcomes</h2>

              <p className="heading-description">
                Current policy versus AI-optimized policy.
              </p>
            </div>
          </div>

          <div style={{ width: "100%", height: 330 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#dce4df"
                />

                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                />

                <YAxis
                  tick={{ fontSize: 10 }}
                />

                <Tooltip />

                <Bar
                  dataKey="current"
                  name="Current Policy"
                  fill="#91a1a9"
                  radius={[4, 4, 0, 0]}
                />

                <Bar
                  dataKey="optimized"
                  name="AI Optimized"
                  fill="#78988a"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">GUARDRAILS</div>

              <h2>AI decision controls</h2>

              <p className="heading-description">
                Distribution of approved and overridden decisions.
              </p>
            </div>
          </div>

          <div
            style={{
              width: "100%",
              height: 300,
              position: "relative",
            }}
          >
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={105}
                  paddingAngle={3}
                >
                  <Cell fill="#78988a" />
                  <Cell fill="#a47d7d" />
                </Pie>

                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            <div className="donut-center">
              <strong>24%</strong>
              <span>Overridden</span>
            </div>
          </div>

          <div className="chart-legend">
            <div>
              <span className="legend-approved" />
              Approved
              <strong>76</strong>
            </div>

            <div>
              <span className="legend-overridden" />
              Overridden
              <strong>24</strong>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* =========================================================
   MODAL
   ========================================================= */

function CaseModal({ item, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="case-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="eyebrow">RECOVERY CASE</div>

            <h2>{item.customer_id}</h2>
          </div>

          <button
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="case-metrics">
          <div>
            <span>Revenue at risk</span>
            <strong>{formatCurrency(item.amount)}</strong>
          </div>

          <div>
            <span>Recovery probability</span>
            <strong>
              {Math.round(item.recovery_probability * 100)}%
            </strong>
          </div>

          <div>
            <span>Issue type</span>
            <strong>{item.issue_type}</strong>
          </div>
        </div>

        <div className="decision-card">
          <div>
            <span>AI DECISION</span>
            <strong>{item.ai_decision}</strong>
          </div>

          <div>
            <span>GUARDRAIL VERDICT</span>

            <strong
              className={
                item.guardrail === "approved"
                  ? "success-text"
                  : "warning-text"
              }
            >
              {item.guardrail === "approved"
                ? "Approved"
                : "Overridden"}
            </strong>
          </div>

          <div>
            <span>EXECUTION STATUS</span>

            <strong>{item.status}</strong>
          </div>

          <div>
            <span>CASE ID</span>

            <strong>{item.id}</strong>
          </div>
        </div>

        <div className="reasoning-block">
          <span>AI REASONING</span>

          <p>{item.reasoning}</p>
        </div>

        <div className="audit-trail">
          <div className="modal-section-title">
            AUDIT TRAIL
          </div>

          {auditTrail.map((entry, index) => (
            <div className="audit-row" key={index}>
              <span className="audit-dot" />

              <div>
                <strong>{entry.title}</strong>

                <p>{entry.text}</p>
              </div>
            </div>
          ))}
        </div>

        <button className="close-case" onClick={onClose}>
          Close case
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   STYLES
   ========================================================= */

const styles = `
:root {
  --bg: #f3f5f4;
  --sidebar: #e9eeeb;
  --panel: #ffffff;
  --panel-soft: #f8faf9;
  --text: #24312d;
  --heading: #18231f;
  --muted: #71807a;
  --muted-light: #8b9892;
  --border: #dce4df;
  --border-strong: #cbd6d0;
  --primary: #667f8e;
  --sage: #78988a;
  --sage-soft: #e6efe9;
  --warning: #b39a70;
  --warning-soft: #f2ecdf;
  --danger: #a47d7d;
  --danger-soft: #f1e7e7;
  --shadow: 0 4px 18px rgba(39,54,48,.055);
  --radius: 12px;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  min-height: 100%;
}

body {
  font-family:
    Inter,
    ui-sans-serif,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    Arial,
    sans-serif;

  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

button,
input {
  font-family: inherit;
}

button {
  cursor: pointer;
}

/* APP */

.app-shell {
  min-height: 100vh;
  display: flex;
  background: var(--bg);
}

/* SIDEBAR */

.sidebar {
  width: 255px;
  min-height: 100vh;
  padding: 26px 18px 20px;
  background: var(--sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px;
}

.brand-symbol {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: #607887;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
}

.brand-name {
  color: var(--heading);
  font-size: 14px;
  font-weight: 700;
}

.brand-caption {
  margin-top: 3px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.2px;
}

.sidebar-divider {
  height: 1px;
  background: var(--border);
  margin: 25px 8px 22px;
}

.nav-label {
  padding: 0 10px;
  margin-bottom: 9px;
  color: var(--muted-light);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.3px;
}

.nav-item {
  width: 100%;
  min-height: 42px;
  margin-bottom: 4px;
  padding: 0 11px;
  display: flex;
  align-items: center;
  gap: 11px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #63716c;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  transition: background .15s ease, color .15s ease;
}

.nav-item:hover {
  background: rgba(255,255,255,.58);
  color: var(--heading);
}

.nav-item.active {
  background: #fff;
  color: #344b58;
  box-shadow: 0 2px 8px rgba(35,48,43,.05);
}

.nav-icon {
  width: 18px;
  color: #81908a;
  font-size: 16px;
  text-align: center;
}

.nav-item.active .nav-icon {
  color: #607887;
}

.nav-count {
  margin-left: auto;
  min-width: 25px;
  height: 21px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border-radius: 20px;
  background: #edf1ef;
  color: #66756f;
  font-size: 10px;
  font-weight: 700;
}

.sidebar-bottom {
  margin-top: auto;
}

.system-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(255,255,255,.55);
  border: 1px solid var(--border);
  border-radius: 9px;
}

.system-indicator {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: var(--sage-soft);
}

.status-dot,
.live-dot {
  width: 7px;
  height: 7px;
  display: block;
  border-radius: 50%;
  background: var(--sage);
}

.system-card strong {
  display: block;
  color: var(--heading);
  font-size: 11px;
}

.system-card small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
}

.version {
  margin-top: 12px;
  padding: 0 4px;
  color: var(--muted-light);
  font-size: 9px;
}

/* MAIN */

.main-content {
  width: calc(100% - 255px);
  margin-left: 255px;
  padding: 38px 44px 65px;
}

/* HEADER */

.main-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 30px;
  margin-bottom: 31px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #83918b;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.15px;
}

.breadcrumb span {
  color: #aeb8b4;
}

.header-copy h1 {
  margin: 8px 0 7px;
  color: var(--heading);
  font-size: 27px;
  line-height: 1.15;
  letter-spacing: -.7px;
  font-weight: 720;
  white-space: nowrap;
}

.header-copy p {
  max-width: 640px;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.header-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.live-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 11px;
  border: 1px solid #d5e2db;
  border-radius: 20px;
  background: #eef4f0;
  color: #60796d;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .9px;
}

.connection-status {
  color: var(--muted-light);
  font-size: 10px;
}

/* METRICS */

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 14px;
  margin-bottom: 20px;
}

.metric-card {
  position: relative;
  min-height: 137px;
  padding: 20px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.metric-card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #91a1a9;
}

.metric-card.risk::before {
  background: #a47d7d;
}

.metric-card.selected::before {
  background: #b39a70;
}

.metric-card.recovered::before {
  background: #78988a;
}

.metric-card.rate::before {
  background: #728a9a;
}

.metric-top {
  display: flex;
  justify-content: space-between;
}

.metric-label {
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
}

.metric-accent {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c6d0cc;
}

.metric-value {
  margin-top: 13px;
  color: var(--heading);
  font-size: 25px;
  line-height: 1.1;
  font-weight: 720;
  letter-spacing: -.6px;
}

.metric-description {
  margin-top: 7px;
  color: var(--muted-light);
  font-size: 10px;
}

/* PANELS */

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 18px;
}

.eyebrow {
  margin-bottom: 5px;
  color: #78909d;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.25px;
}

.panel-heading h2 {
  margin: 0;
  color: var(--heading);
  font-size: 16px;
  line-height: 1.3;
  font-weight: 680;
}

.heading-description {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 11px;
}

.text-button {
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: #657f8e;
  font-size: 11px;
  font-weight: 650;
}

/* AI IMPACT */

.impact-panel {
  margin-bottom: 20px;
  padding: 23px 24px;
}

.impact-content {
  display: grid;
  grid-template-columns:
    minmax(190px,1fr)
    150px
    minmax(210px,1.1fr)
    minmax(175px,.85fr);
  align-items: center;
  gap: 16px;
}

.policy-block {
  min-height: 144px;
  padding: 18px;
  background: var(--panel-soft);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.policy-block.optimized {
  background: #f4f8f6;
  border-color: #cddbd4;
}

.policy-label,
.optimized-label {
  display: block;
  margin-bottom: 9px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .9px;
}

.optimized-label {
  color: #718b7f;
}

.policy-block > strong {
  display: block;
  color: var(--heading);
  font-size: 22px;
}

.policy-block.optimized > strong {
  color: #5e7e70;
}

.policy-block > small {
  display: block;
  margin-top: 5px;
  color: var(--muted-light);
  font-size: 10px;
}

.policy-stats {
  display: flex;
  gap: 14px;
  margin-top: 18px;
}

.policy-stats span {
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: var(--muted-light);
  font-size: 9px;
}

.policy-stats b {
  color: var(--text);
  font-size: 12px;
}

.optimization-divider {
  display: flex;
  align-items: center;
  gap: 7px;
}

.optimization-line {
  flex: 1;
  height: 1px;
  background: var(--border);
}

.optimization-badge {
  padding: 6px 9px;
  border: 1px solid #d5e0e4;
  border-radius: 20px;
  background: #edf2f4;
  color: #667f8d;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .7px;
  white-space: nowrap;
}

.impact-result {
  padding-left: 18px;
  border-left: 1px solid var(--border);
}

.impact-result span {
  display: block;
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .8px;
}

.impact-result strong {
  display: block;
  margin-top: 9px;
  color: #668477;
  font-size: 21px;
}

.impact-result small {
  display: block;
  margin-top: 5px;
  color: #82928b;
  font-size: 10px;
}

/* TWO COLUMNS */

.content-grid {
  display: grid;
  grid-template-columns: 1.15fr .85fr;
  gap: 20px;
  margin-bottom: 20px;
}

.content-grid > .panel,
.cases-panel {
  padding: 22px;
}

/* QUEUE */

.opportunity-list {
  display: flex;
  flex-direction: column;
}

.opportunity {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  gap: 13px;
  align-items: center;
  padding: 14px 3px;
  border-top: 1px solid var(--border);
  cursor: pointer;
  transition: background .15s ease;
}

.opportunity:first-child {
  border-top: 0;
}

.opportunity:hover {
  background: #fafcfb;
  border-radius: 7px;
}

.opportunity-rank {
  color: #a0aaa6;
  font-size: 10px;
  font-weight: 700;
}

.opportunity-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.opportunity-top strong {
  color: var(--heading);
  font-size: 12px;
}

.priority {
  padding: 3px 7px;
  border-radius: 20px;
  font-size: 8px;
  font-weight: 800;
}

.priority.high {
  background: var(--danger-soft);
  color: #8d6d6d;
}

.priority.medium {
  background: var(--warning-soft);
  color: #927e59;
}

.priority.low {
  background: var(--sage-soft);
  color: #668275;
}

.opportunity-type {
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
}

.opportunity-action {
  margin-top: 5px;
  color: #738793;
  font-size: 10px;
}

.opportunity-value {
  text-align: right;
}

.opportunity-value strong {
  display: block;
  color: var(--heading);
  font-size: 13px;
}

.opportunity-value span {
  display: block;
  margin-top: 4px;
  color: var(--muted-light);
  font-size: 9px;
}

/* PIPELINE */

.pipeline {
  display: flex;
  align-items: center;
  padding: 17px 2px 23px;
}

.pipeline-step {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 80px;
}

.pipeline-number {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  background: #eef2f1;
  border: 1px solid #d6dfdb;
  color: #667a73;
  font-size: 9px;
  font-weight: 800;
}

.pipeline-step strong {
  display: block;
  color: var(--heading);
  font-size: 10px;
}

.pipeline-step span {
  display: block;
  margin-top: 3px;
  color: var(--muted-light);
  font-size: 9px;
}

.pipeline-connector {
  flex: 1;
  height: 1px;
  min-width: 10px;
  margin: 0 8px;
  background: var(--border-strong);
}

.pipeline-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.pipeline-footer div {
  display: flex;
  justify-content: space-between;
}

.pipeline-footer span {
  color: var(--muted);
  font-size: 10px;
}

.pipeline-footer strong {
  color: var(--heading);
  font-size: 11px;
}

/* TABLE */

.cases-panel {
  margin-bottom: 0;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.case-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.case-table th {
  padding: 10px 9px;
  background: var(--panel-soft);
  color: var(--muted-light);
  border-bottom: 1px solid var(--border);
  font-size: 8px;
  font-weight: 800;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: .8px;
}

.case-table td {
  padding: 12px 9px;
  border-bottom: 1px solid #edf1ef;
  color: var(--muted);
}

.case-table tbody tr {
  cursor: pointer;
  transition: background .12s ease;
}

.case-table tbody tr:hover {
  background: #f7faf8;
}

.case-table td strong {
  color: var(--heading);
  font-size: 11px;
}

.amount {
  color: var(--heading) !important;
  font-weight: 650;
}

.guardrail,
.status {
  display: inline-flex;
  align-items: center;
  padding: 4px 7px;
  border-radius: 20px;
  font-size: 8px;
  font-weight: 800;
}

.guardrail.approved,
.status.executed {
  background: var(--sage-soft);
  color: #688073;
}

.guardrail.overridden,
.status.escalated {
  background: var(--warning-soft);
  color: #927d58;
}

.status.stopped {
  background: var(--danger-soft);
  color: #8d6d6d;
}

.empty {
  padding: 35px !important;
  text-align: center;
  color: var(--muted-light) !important;
}

/* FULL PANEL */

.full-panel {
  padding: 24px;
}

.queue-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 18px;
}

.filters {
  display: flex;
  gap: 5px;
}

.filter {
  padding: 7px 11px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--panel);
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
}

.filter.active {
  background: #e9eff1;
  border-color: #cbd9df;
  color: #5e7582;
}

.search {
  width: 285px;
  padding: 9px 11px;
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 7px;
  outline: none;
  font-size: 11px;
}

.search:focus {
  border-color: #aabdc6;
  box-shadow: 0 0 0 3px rgba(117,143,156,.08);
}

/* STRATEGY */

.strategy-hero {
  display: grid;
  grid-template-columns: 1fr 180px 1fr;
  align-items: stretch;
  gap: 18px;
}

.strategy-side {
  position: relative;
  padding: 24px;
  background: var(--panel-soft);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.strategy-side.ai {
  background: #f4f8f6;
  border-color: #cadbd2;
}

.strategy-side > span {
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
}

.strategy-side > strong {
  display: block;
  margin-top: 11px;
  color: var(--heading);
  font-size: 28px;
}

.strategy-side.ai > strong {
  color: #5f7d70;
}

.strategy-side > small {
  display: block;
  margin-top: 5px;
  color: var(--muted-light);
  font-size: 10px;
}

.strategy-counts {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 10px;
  margin-top: 23px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
}

.strategy-counts div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.strategy-counts b {
  color: var(--heading);
  font-size: 13px;
}

.strategy-counts span {
  color: var(--muted-light);
  font-size: 9px;
}

.strategy-middle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.strategy-middle span {
  color: #758893;
  font-size: 8px;
  font-weight: 800;
}

.strategy-middle strong {
  margin-top: 8px;
  color: #668477;
  font-size: 19px;
}

.strategy-middle small {
  margin-top: 5px;
  color: var(--muted-light);
  font-size: 9px;
}

.ai-policy-label {
  position: absolute;
  top: 13px;
  right: 13px;
  padding: 4px 7px;
  border-radius: 20px;
  background: #e4eee9;
  color: #6b877a;
  font-size: 7px;
  font-weight: 800;
}

.strategy-explanation {
  max-width: 760px;
  margin-top: 25px;
  padding-top: 22px;
  border-top: 1px solid var(--border);
}

.strategy-explanation h2 {
  margin: 6px 0 8px;
  color: var(--heading);
  font-size: 17px;
}

.strategy-explanation p {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
}

/* AUDIT */

.audit-summary {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 12px;
  margin-bottom: 18px;
}

.audit-stat {
  padding: 17px;
  background: var(--panel-soft);
  border: 1px solid var(--border);
  border-radius: 9px;
}

.audit-stat span {
  display: block;
  color: var(--muted);
  font-size: 9px;
}

.audit-stat strong {
  display: block;
  margin-top: 7px;
  color: var(--heading);
  font-size: 21px;
}

.audit-stat.warning strong {
  color: #927d58;
}

.audit-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 23px;
  padding: 15px;
  background: #f5f8f6;
  border: 1px solid #dce7e1;
  border-radius: 9px;
}

.audit-symbol {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--sage-soft);
  color: #668274;
  font-size: 12px;
  font-weight: 800;
}

.audit-message strong {
  color: var(--heading);
  font-size: 11px;
}

.audit-message p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.55;
}

.panel-subheading {
  margin-bottom: 11px;
  color: var(--heading);
  font-size: 12px;
  font-weight: 680;
}

/* CHARTS */

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.chart-panel {
  padding: 22px;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 22px;
  padding-top: 8px;
}

.chart-legend div {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 9px;
}

.chart-legend div > span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.legend-approved {
  background: #78988a;
}

.legend-overridden {
  background: #a47d7d;
}

.chart-legend strong {
  margin-left: 3px;
  color: var(--heading);
  font-size: 10px;
}

.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.donut-center strong {
  color: var(--heading);
  font-size: 22px;
}

.donut-center span {
  margin-top: 3px;
  color: var(--muted);
  font-size: 9px;
}

/* MODAL */

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(28,37,34,.45);
  backdrop-filter: blur(4px);
}

.case-modal {
  width: 100%;
  max-width: 650px;
  max-height: 86vh;
  overflow-y: auto;
  padding: 25px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 13px;
  box-shadow: 0 20px 60px rgba(26,38,33,.18);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  margin: 4px 0 0;
  color: var(--heading);
  font-size: 20px;
}

.modal-close {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--panel-soft);
  color: var(--muted);
  font-size: 18px;
}

.case-metrics {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 10px;
  margin: 18px 0;
}

.case-metrics > div {
  padding: 13px;
  background: var(--panel-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.case-metrics span {
  display: block;
  color: var(--muted);
  font-size: 9px;
}

.case-metrics strong {
  display: block;
  margin-top: 6px;
  color: var(--heading);
  font-size: 14px;
}

.decision-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 15px;
  background: #f5f8f7;
  border: 1px solid #dce6e1;
  border-radius: 9px;
}

.decision-card div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.decision-card span,
.reasoning-block > span {
  color: var(--muted);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .9px;
}

.decision-card strong {
  color: var(--heading);
  font-size: 11px;
}

.success-text {
  color: #648174 !important;
}

.warning-text {
  color: #967d56 !important;
}

.reasoning-block {
  margin-top: 19px;
}

.reasoning-block p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}

.audit-trail {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}

.modal-section-title {
  margin-bottom: 8px;
  color: var(--heading);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .9px;
}

.audit-row {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #edf1ef;
}

.audit-dot {
  width: 7px;
  height: 7px;
  margin-top: 4px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #81998d;
}

.audit-row strong {
  color: var(--heading);
  font-size: 10px;
}

.audit-row p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.45;
}

.close-case {
  width: 100%;
  margin-top: 18px;
  padding: 10px;
  border: 1px solid #cbd8d3;
  border-radius: 7px;
  background: #edf3f0;
  color: #5e776b;
  font-size: 10px;
  font-weight: 700;
}

/* RESPONSIVE */

@media (max-width: 1150px) {
  .main-content {
    padding: 32px 28px 55px;
  }

  .impact-content {
    grid-template-columns: 1fr 100px 1fr;
  }

  .impact-result {
    grid-column: 1 / -1;
    padding: 15px 0 0;
    border-left: 0;
    border-top: 1px solid var(--border);
    text-align: center;
  }

  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .sidebar {
    width: 210px;
  }

  .main-content {
    width: calc(100% - 210px);
    margin-left: 210px;
  }

  .metric-grid {
    grid-template-columns: repeat(2,1fr);
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .strategy-hero {
    grid-template-columns: 1fr;
  }

  .strategy-middle {
    padding: 10px;
  }
}

@media (max-width: 700px) {
  .sidebar {
    position: static;
    width: 100%;
    min-height: auto;
    padding: 15px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .app-shell {
    display: block;
  }

  .main-content {
    width: 100%;
    margin-left: 0;
    padding: 25px 16px 45px;
  }

  .sidebar-bottom {
    display: none;
  }

  .nav-item {
    display: inline-flex;
    width: auto;
  }

  .nav-count {
    display: none;
  }

  .main-header {
    flex-direction: column;
  }

  .header-status {
    align-items: flex-start;
  }

  .header-copy h1 {
    white-space: normal;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .impact-content {
    grid-template-columns: 1fr;
  }

  .optimization-divider {
    padding: 5px 0;
  }

  .queue-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search {
    width: 100%;
  }

  .audit-summary {
    grid-template-columns: 1fr 1fr;
  }

  .case-metrics {
    grid-template-columns: 1fr;
  }
}

/* DARK MODE */

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #171c1b;
    --sidebar: #141918;
    --panel: #1d2422;
    --panel-soft: #202926;
    --text: #d5ddda;
    --heading: #edf2ef;
    --muted: #9aa8a2;
    --muted-light: #788680;
    --border: #303a36;
    --border-strong: #3a4641;
    --sage: #829f91;
    --sage-soft: #26352f;
    --warning-soft: #352f23;
    --danger-soft: #352829;
  }

  .nav-item:hover {
    background: #202725;
  }

  .nav-item.active {
    background: #222b28;
    color: #dbe3df;
  }

  .nav-count {
    background: #29322f;
    color: #a5b1ac;
  }

  .system-card {
    background: #1d2522;
  }

  .live-pill {
    background: #26332e;
    border-color: #34443c;
    color: #9bb0a5;
  }

  .policy-block {
    background: #202825;
  }

  .policy-block.optimized {
    background: #22302b;
    border-color: #3b4d45;
  }

  .optimization-badge {
    background: #273239;
    border-color: #3b4a51;
    color: #9aadb7;
  }

  .opportunity:hover,
  .case-table tbody tr:hover {
    background: #202825;
  }

  .pipeline-number {
    background: #28312e;
    border-color: #3b4642;
  }

  .case-table th {
    background: #202825;
  }

  .case-table td {
    border-bottom-color: #2b3431;
  }

  .filter.active {
    background: #29353a;
    border-color: #40505a;
    color: #a4b5bd;
  }

  .search {
    background: #1d2422;
  }

  .strategy-side {
    background: #202825;
  }

  .strategy-side.ai {
    background: #22302b;
    border-color: #3b4d45;
  }

  .audit-message,
  .decision-card {
    background: #202b27;
    border-color: #35453e;
  }

  .close-case {
    background: #293732;
    border-color: #3c5048;
    color: #a4b7ad;
  }

  .modal-overlay {
    background: rgba(0,0,0,.65);
  }
}
`;

export default App;