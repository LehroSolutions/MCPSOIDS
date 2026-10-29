import { HealthConsole } from '../components/HealthConsole';
import { Dashboard } from '../components/Dashboard';


export default function Home() {
  return (
    <main className="min-h-screen p-8 md:p-12 relative">
      {/* Background Mesh */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black -z-10" />
      <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      <div className="max-w-5xl mx-auto space-y-10 relative z-10">

        {/* Header */}
        <div className="flex items-end justify-between border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-3 text-emerald-500 font-mono text-xs tracking-[0.2em] mb-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              ACTIVE CONNECTION ESTABLISHED
            </div>
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-500 tracking-tight">
              MCPSOIDS
            </h1>
            <p className="text-slate-400 mt-2 font-light text-lg">Active Robustness Monitor // <span className="text-accent-secondary font-mono">Reference Server v1.0</span></p>
          </div>
        </div>

        {/* The "Wow" Dashboard */}
        <HealthConsole />

        <Dashboard />

        {/* Footer */}
        <div className="text-center border-t border-white/5 pt-8 mt-12 pb-8">
          <p className="text-slate-500 text-xs font-mono uppercase tracking-widest">
            Model Context Protocol v2025.12 // Antigravity Agent // Secure Environment
          </p>
        </div>
      </div>
    </main>

  );
}
