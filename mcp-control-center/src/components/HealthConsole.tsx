"use client";

import { useEffect, useState } from 'react';
import { fetchHealth, HealthStatus } from '../lib/mcp-client';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, Zap, Database } from 'lucide-react';
import { clsx } from 'clsx';


export function HealthConsole() {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        let timer: ReturnType<typeof setTimeout>;
        const refresh = async () => {
            try {
                const data = await fetchHealth();
                if (!active) return;
                setHealth(data);
                setError(null);
            } catch {
                if (active) setError("CONNECTION LOST");
            } finally {
                if (active) timer = setTimeout(refresh, 15000);
            }
        };
        void refresh();
        return () => { active = false; clearTimeout(timer); };
    }, []);

    const statusColor = health?.status === 'green' ? 'text-green-400'
        : health?.status === 'yellow' ? 'text-yellow-400'
            : 'text-red-500';

    const isLoading = !health && !error;

    return (
        <div
            className="glass-panel rounded-2xl p-8 relative overflow-hidden group"
            role="region"
            aria-label="System Health Monitor"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            <div className="flex items-center justify-between mb-8 relative z-10">
                <h2 className="text-2xl font-bold flex items-center gap-3 text-white tracking-tight">
                    <Activity className="w-6 h-6 text-emerald-400" aria-hidden="true" />
                    <span className="neon-text">SYSTEM VITALITY</span>
                </h2>

                {/* Status Indicator */}
                <div role="status" aria-live="polite">
                    {error ? (
                        <span className="text-red-500 font-mono animate-pulse font-bold bg-red-950/50 px-3 py-1 rounded border border-red-500/30 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </span>
                    ) : isLoading ? (
                        <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-full border border-white/5 animate-pulse">
                            <div className="w-3 h-3 rounded-full bg-slate-600" />
                            <div className="h-4 w-24 bg-slate-600 rounded" />
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-full border border-white/5">
                            <div className="relative">
                                <motion.div
                                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                    className={clsx("absolute inset-0 rounded-full", statusColor.replace('text', 'bg'))}
                                />
                                <div className={clsx("w-3 h-3 rounded-full relative z-10", statusColor.replace('text', 'bg'))} />
                            </div>
                            <span className={clsx("font-mono uppercase font-bold text-sm tracking-wider", statusColor)}>
                                {health?.status}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                <MetricCard
                    label="Uptime Session"
                    value={isLoading ? "---" : `${health?.metrics.uptime_seconds || 0}s`}
                    icon={<Zap className="w-4 h-4 text-yellow-400" aria-hidden="true" />}
                    loading={isLoading}
                />
                <MetricCard
                    label="Memory Load"
                    value={isLoading ? "---" : `${health?.metrics.memory_usage_mb || 0} MB`}
                    alert={health?.metrics.memory_usage_mb && health.metrics.memory_usage_mb > 200}
                    icon={<Database className="w-4 h-4 text-purple-400" aria-hidden="true" />}
                    loading={isLoading}
                />
                <MetricCard
                    label="Active Threads"
                    value={isLoading ? "---" : health?.metrics.active_requests || 0}
                    icon={<Activity className="w-4 h-4 text-blue-400" aria-hidden="true" />}
                    loading={isLoading}
                />
            </div>

            {health?.self_heal_hint && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="alert"
                    className="mt-6 p-4 bg-red-500/10 border border-red-500/40 rounded-xl flex items-center gap-3 text-red-200 shadow-[0_0_30px_-10px_rgba(239,68,68,0.3)]"
                >
                    <AlertTriangle className="w-6 h-6 text-red-500 animate-bounce" />
                    <div>
                        <div className="font-bold text-red-400 text-sm uppercase mb-1">Autonomous Intervention</div>
                        <div className="font-mono text-sm">JANITOR PROTOCOL ENGAGED: {health.self_heal_hint}</div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

function MetricCard({ label, value, alert, icon, loading }: { label: string, value: string | number, alert?: boolean | number | "", icon?: React.ReactNode, loading?: boolean }) {
    return (
        <div className={clsx(
            "p-5 rounded-xl border transition-all duration-300 group/card relative overflow-hidden",
            alert
                ? "bg-red-950/30 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                : "bg-slate-800/40 border-white/5 hover:bg-slate-800/60 hover:border-emerald-500/30"
        )}>
            {loading && <div className="absolute inset-0 bg-slate-800/50 animate-pulse z-20" />}

            <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{label}</div>
                {icon}
            </div>
            <div className={clsx(
                "text-3xl font-mono font-light tracking-tighter group-hover/card:scale-105 transition-transform origin-left",
                alert ? "text-red-400" : "text-white"
            )}>
                {value}
            </div>
        </div>
    );
}
