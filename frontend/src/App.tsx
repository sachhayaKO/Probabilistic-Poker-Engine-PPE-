import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Github, CheckCircle2, Clock, ExternalLink, ChevronRight } from 'lucide-react'

// ─── Data ────────────────────────────────────────────────────────────────────

const milestones = [
  { label: 'Finalize data contracts between engine/ and backend/', done: true },
  { label: 'Implement card/deck primitives and deterministic shuffling', done: true },
  { label: 'Implement minimal hand evaluator for showdown ranking', done: true },
  { label: 'Define game state transitions for heads-up preflop/flop/turn/river', done: true },
  { label: 'Draft and validate /start_game, /game_state API responses', done: true },
  { label: 'Set up first smoke tests for backend and evaluator edge cases', done: true },
  { label: 'Document baseline cheat-bot probability assumptions', done: false },
]

const apiEndpoints = [
  {
    method: 'POST',
    route: '/start_game',
    description: 'Create a new game and return an initial client-safe state snapshot',
    response: `{
  "game_id": "uuid-string",
  "street": "preflop",
  "pot": 0,
  "player_stack": 1000,
  "bot_stack": 1000,
  "player_hand": ["Ah", "Kd"],
  "board": [],
  "betting_history": []
}`,
  },
  {
    method: 'GET',
    route: '/game_state/{game_id}',
    description: 'Return the current client-safe state snapshot for a game',
    response: `{
  "game_id": "uuid-string",
  "street": "flop",
  "pot": 0,
  "player_stack": 1000,
  "bot_stack": 1000,
  "player_hand": ["Ah", "Kd"],
  "board": ["7c", "2s", "Td"],
  "betting_history": []
}`,
  },
  {
    method: 'GET',
    route: '/health',
    description: 'Service liveness endpoint',
    response: `{
  "status": "ok"
}`,
  },
]

type PipelineStatus = 'LIVE' | 'SCAFFOLDED' | 'TODO'

const mlPipeline: { label: string; detail: string; status: PipelineStatus }[] = [
  { label: 'State Encoder', detail: '30-dim', status: 'LIVE' },
  { label: 'Monte Carlo Equity Estimator', detail: 'MC sampling', status: 'LIVE' },
  { label: 'PPEActorCritic', detail: 'PPO', status: 'LIVE' },
  { label: 'BotAgent', detail: 'inference', status: 'LIVE' },
  { label: 'Self-Play Training Loop', detail: 'orchestration', status: 'SCAFFOLDED' },
  { label: 'Hand Evaluator', detail: 'showdown', status: 'LIVE' },
]

const testFiles = [
  { file: 'engine/tests/test_evaluator_cases.py', module: 'Engine', count: 5 },
  { file: 'engine/tests/ml/test_equity.py', module: 'ML', count: 6 },
  { file: 'engine/tests/ml/test_model.py', module: 'ML', count: 6 },
  { file: 'engine/tests/ml/test_state_encoder.py', module: 'ML', count: 5 },
  { file: 'engine/tests/ml/test_agent.py', module: 'ML', count: 4 },
  { file: 'backend/tests/test_api_smoke.py', module: 'Backend', count: 1 },
  { file: 'backend/tests/test_api_persistence.py', module: 'Backend', count: 3 },
]

const techStack = [
  { label: 'Python 3.11', color: '#f8fafc', bg: 'rgba(248,250,252,0.05)' },
  { label: 'FastAPI', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  { label: 'PyTorch', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  { label: 'Pydantic', color: '#ca8a04', bg: 'rgba(202,138,4,0.1)' },
  { label: 'Pytest', color: '#ca8a04', bg: 'rgba(202,138,4,0.08)' },
  { label: 'Vite', color: '#f8fafc', bg: 'rgba(248,250,252,0.04)' },
  { label: 'React', color: '#f8fafc', bg: 'rgba(248,250,252,0.05)' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PipelineStatus }) {
  if (status === 'LIVE') return <span className="badge-live"><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />LIVE</span>
  if (status === 'SCAFFOLDED') return <span className="badge-scaffolded"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />SCAFFOLDED</span>
  return <span className="badge-todo"><span className="w-1.5 h-1.5 rounded-full bg-slate-500" />TODO</span>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-widest mb-4">
      {children}
    </h2>
  )
}

// ─── Section: Header ─────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="border-b border-red-900/40 border-t-2 border-t-red-600 bg-black-950/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Card suit icon */}
          <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center">
            <svg viewBox="0 0 16 16" className="w-4 h-4 fill-red-400" aria-hidden="true">
              <path d="M8 1C5 1 2 3.5 2 6.5 2 10 5 12 8 15c3-3 6-5 6-8.5C14 3.5 11 1 8 1z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100 leading-tight">
              Probabilistic Poker Engine
            </h1>
            <p className="text-xs text-slate-500 font-mono">
              Heads-Up Texas Hold'em · ML Research Platform
            </p>
          </div>
        </div>
        <a
          href="https://github.com/sachhayaKO/Probabilistic-Poker-Engine-PPE-"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:border-white/[0.15] transition-all duration-200 cursor-pointer text-xs font-medium"
          aria-label="View source on GitHub"
        >
          <Github className="w-3.5 h-3.5" aria-hidden="true" />
          <span>GitHub</span>
          <ExternalLink className="w-3 h-3 opacity-50" aria-hidden="true" />
        </a>
      </div>
    </header>
  )
}

// ─── Section: Milestone Tracker ───────────────────────────────────────────────

function MilestoneTracker() {
  const done = milestones.filter(m => m.done).length
  const total = milestones.length
  const pct = Math.round((done / total) * 100)

  return (
    <section className="card" aria-labelledby="milestone-heading">
      <SectionTitle>Week 1 · Milestone Tracker</SectionTitle>
      <div className="flex items-center justify-between mb-3">
        <h3 id="milestone-heading" className="text-base font-semibold text-slate-100">
          Sprint Progress
        </h3>
        <span className="text-sm font-mono font-semibold text-red-400">{done}/{total} · {pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-800 rounded-full mb-5 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% complete`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Checklist */}
      <ul className="space-y-2.5">
        {milestones.map((m, i) => (
          <li key={i} className="flex items-start gap-3">
            {m.done ? (
              <CheckCircle2 className="w-4 h-4 text-red-500 mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span className={`text-sm leading-snug ${m.done ? 'text-slate-300' : 'text-slate-400'}`}>
              {m.label}
            </span>
            {m.done ? (
              <span className="ml-auto shrink-0 text-xs font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">DONE</span>
            ) : (
              <span className="ml-auto shrink-0 text-xs font-mono text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded">IN PROGRESS</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Section: Architecture Diagram ───────────────────────────────────────────

function ArchitectureOverview() {
  const nodes = [
    { label: 'Client / UI', sub: 'Browser', color: '#f8fafc' },
    { label: 'FastAPI Backend', sub: 'REST API', color: '#dc2626' },
    { label: 'Poker Engine', sub: 'Game Logic', color: '#ef4444' },
    { label: 'ML Bot', sub: 'PPO + Monte Carlo', color: '#ca8a04' },
    { label: 'Storage', sub: 'In-memory store', color: '#64748b' },
  ]

  return (
    <section className="card" aria-label="Architecture overview">
      <SectionTitle>Architecture · Component Map</SectionTitle>
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center gap-0 min-w-max">
          {nodes.map((node, i) => (
            <div key={i} className="flex items-center">
              {/* Node box */}
              <div
                className="rounded-xl px-4 py-3 border text-center min-w-[120px]"
                style={{
                  background: `${node.color}0d`,
                  borderColor: `${node.color}30`,
                }}
              >
                <div className="text-sm font-semibold" style={{ color: node.color }}>
                  {node.label}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-mono">{node.sub}</div>
              </div>
              {/* Arrow */}
              {i < nodes.length - 1 && (
                <div className="flex items-center px-1" aria-hidden="true">
                  <div className="w-5 h-px bg-slate-700" />
                  <ChevronRight className="w-4 h-4 text-slate-600 -ml-1" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend row */}
      <div className="mt-4 pt-4 border-t border-white/[0.05] flex flex-wrap gap-x-6 gap-y-2">
        {[
          { color: '#f8fafc', label: 'Presentation layer' },
          { color: '#dc2626', label: 'API layer' },
          { color: '#ef4444', label: 'Domain logic' },
          { color: '#ca8a04', label: 'ML inference' },
          { color: '#64748b', label: 'Persistence' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Section: API Endpoints ───────────────────────────────────────────────────

function ApiEndpointsPanel() {
  return (
    <section aria-label="API endpoints">
      <SectionTitle>API Endpoints · Live</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {apiEndpoints.map((ep, i) => (
          <div key={i} className="card flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={ep.method === 'POST' ? 'method-post' : 'method-get'}>
                {ep.method}
              </span>
              <code className="text-sm font-mono text-slate-200 truncate">{ep.route}</code>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">{ep.description}</p>
            <div className="mt-auto">
              <div className="text-xs font-mono text-slate-500 mb-1.5">Response</div>
              <pre className="text-xs font-mono text-slate-300 bg-slate-950/60 rounded-lg p-3 overflow-x-auto border border-white/[0.04] leading-relaxed">
                {ep.response}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Section: ML Pipeline ────────────────────────────────────────────────────

function MLPipelineStatus() {
  return (
    <section className="card" aria-label="ML pipeline status">
      <SectionTitle>ML Pipeline · Component Status</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {mlPipeline.map((stage, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.05] bg-slate-950/40"
          >
            <div>
              <div className="text-sm font-semibold text-slate-200">{stage.label}</div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">{stage.detail}</div>
            </div>
            <StatusBadge status={stage.status} />
          </div>
        ))}
      </div>

      {/* Flow arrow diagram */}
      <div className="mt-5 pt-4 border-t border-white/[0.05]">
        <div className="text-xs text-slate-500 font-mono mb-3">Inference path</div>
        <div className="overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max text-xs font-mono">
            {['State Encoder', 'MC Equity', 'ActorCritic', 'BotAgent'].map((step, i, arr) => (
              <div key={i} className="flex items-center gap-1">
                <span className="px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                  {step}
                </span>
                {i < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Section: Test Coverage ───────────────────────────────────────────────────

const moduleColors: Record<string, string> = {
  Engine: '#dc2626',
  ML: '#ef4444',
  Backend: '#ca8a04',
}

function TestCoverage() {
  const total = testFiles.reduce((s, f) => s + f.count, 0)
  const maxCount = Math.max(...testFiles.map(f => f.count))

  const moduleData = [
    { name: 'Engine', count: testFiles.filter(f => f.module === 'Engine').reduce((s, f) => s + f.count, 0) },
    { name: 'ML', count: testFiles.filter(f => f.module === 'ML').reduce((s, f) => s + f.count, 0) },
    { name: 'Backend', count: testFiles.filter(f => f.module === 'Backend').reduce((s, f) => s + f.count, 0) },
  ]

  return (
    <section aria-labelledby="tests-heading">
      <SectionTitle>Test Coverage · {total} Tests</SectionTitle>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Test file table */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 id="tests-heading" className="text-sm font-semibold text-slate-200">Test Files</h3>
            <span className="text-xs font-mono text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
              {total} total
            </span>
          </div>
          <table className="w-full text-sm" aria-label="Test file list">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="text-left text-xs font-mono text-slate-500 pb-2 font-medium">File</th>
                <th className="text-right text-xs font-mono text-slate-500 pb-2 font-medium pr-2">Tests</th>
                <th className="text-right text-xs font-mono text-slate-500 pb-2 font-medium">Module</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {testFiles.map((tf, i) => (
                <tr key={i} className="group">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      {/* Mini bar */}
                      <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(tf.count / maxCount) * 100}%`,
                            background: moduleColors[tf.module],
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <code className="text-xs font-mono text-slate-400 group-hover:text-slate-200 transition-colors truncate max-w-[280px]">
                        {tf.file}
                      </code>
                    </div>
                  </td>
                  <td className="py-2.5 pr-2 text-right font-mono text-xs text-slate-300">
                    {tf.count}
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{
                        color: moduleColors[tf.module],
                        background: `${moduleColors[tf.module]}15`,
                      }}
                    >
                      {tf.module}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bar chart */}
        <div className="card flex flex-col">
          <div className="text-sm font-semibold text-slate-200 mb-4">By Module</div>
          <div className="flex-1 min-h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#111111',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    fontFamily: 'JetBrains Mono',
                    fontSize: 12,
                    color: '#e2e8f0',
                  }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {moduleData.map((entry, index) => (
                    <Cell key={index} fill={moduleColors[entry.name]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Section: Tech Stack Footer ───────────────────────────────────────────────

function TechStackFooter() {
  return (
    <footer className="border-t border-white/[0.06] py-8 mt-4">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-xs font-mono text-slate-600 mb-4 uppercase tracking-widest">Tech Stack</div>
        <div className="flex flex-wrap gap-2.5 mb-6">
          {techStack.map((tech, i) => (
            <span
              key={i}
              className="text-xs font-mono font-medium px-3 py-1.5 rounded-full border"
              style={{
                color: tech.color,
                background: tech.bg,
                borderColor: `${tech.color}30`,
              }}
            >
              {tech.label}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <p className="text-xs text-slate-600 font-mono">
            Probabilistic Poker Engine · ML Research Platform
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
            Dashboard live
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <div className="min-h-screen bg-[#000000] text-[#f8fafc]">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Hero stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Sprint Progress', value: '86%', sub: '6 of 7 milestones', color: '#dc2626' },
            { label: 'Tests Passing', value: '30', sub: 'across 7 files', color: '#f8fafc' },
            { label: 'API Endpoints', value: '3', sub: 'all documented', color: '#dc2626' },
            { label: 'ML Components', value: '5 / 6', sub: 'LIVE in pipeline', color: '#ca8a04' },
          ].map((stat, i) => (
            <div key={i} className="card stat-card">
              <div className="text-2xl font-bold font-mono" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-xs font-semibold text-slate-300 mt-1">{stat.label}</div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">{stat.sub}</div>
            </div>
          ))}
        </div>

        <MilestoneTracker />
        <ArchitectureOverview />
        <ApiEndpointsPanel />
        <MLPipelineStatus />
        <TestCoverage />
      </main>

      <TechStackFooter />
    </div>
  )
}
