"use client";

import { useEffect, useState } from 'react';
import { FileCheck2, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import { AuditEntry, AuditIntegrity, fetchAuditEntries, fetchAuditIntegrity } from '../lib/mcp-client';
import { clsx } from 'clsx';

function shortHash(hash: string | undefined) {
    return hash ? `${hash.slice(0, 10)}...` : 'none';
}

export function AuditPanel() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [integrity, setIntegrity] = useState<AuditIntegrity | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = () => {
        return Promise.all([
                fetchAuditEntries(12),
                fetchAuditIntegrity(),
            ]).then(([nextEntries, nextIntegrity]) => {
            setEntries(nextEntries);
            setIntegrity(nextIntegrity);
            setError(null);
        }).catch((err) => {
            setError(err instanceof Error ? err.message : 'Failed to load audit trail');
        }).finally(() => {
            setLoading(false);
        });
    };

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <section className="glass-panel rounded-2xl p-6 mt-8">
            <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                        <FileCheck2 className="w-5 h-5 text-cyan-300" />
                        Audit Trail
                    </h2>
                    <p className="text-xs text-slate-500 font-mono mt-1">Hashed append-only execution records</p>
                </div>
                <div className="flex items-center gap-3">
                    {integrity && (
                        <div className={clsx(
                            "text-xs font-mono px-3 py-1.5 rounded-full border flex items-center gap-2",
                            integrity.valid
                                ? "text-emerald-300 border-emerald-500/30 bg-emerald-950/30"
                                : "text-red-300 border-red-500/30 bg-red-950/30"
                        )}>
                            {integrity.valid ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                            {integrity.valid ? 'CHAIN VALID' : 'CHAIN ALERT'}
                        </div>
                    )}
                    <button
                        onClick={() => { setLoading(true); void refresh(); }}
                        disabled={loading}
                        className="p-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-cyan-400/40 disabled:opacity-50"
                        aria-label="Refresh audit trail"
                    >
                        <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {error && (
                <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-200 font-mono">
                    {error}
                </div>
            )}

            {entries.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-sm text-slate-500">
                    No audit entries yet. Run a tool to generate a hashed record.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-[10px] uppercase tracking-widest text-slate-500">
                            <tr className="border-b border-white/10">
                                <th className="py-2 pr-4">Time</th>
                                <th className="py-2 pr-4">Tool</th>
                                <th className="py-2 pr-4">Outcome</th>
                                <th className="py-2 pr-4">Policy</th>
                                <th className="py-2 pr-4">Input Hash</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry) => (
                                <tr key={entry.id} className="border-b border-white/5 last:border-0">
                                    <td className="py-3 pr-4 text-slate-400 font-mono text-xs">
                                        {new Date(entry.timestamp).toLocaleTimeString()}
                                    </td>
                                    <td className="py-3 pr-4 text-white font-mono">{entry.toolName}</td>
                                    <td className="py-3 pr-4">
                                        <span className={clsx(
                                            "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                                            entry.outcome === 'allowed'
                                                ? "bg-emerald-500/10 text-emerald-300"
                                                : entry.outcome === 'denied'
                                                    ? "bg-red-500/10 text-red-300"
                                                    : "bg-yellow-500/10 text-yellow-300"
                                        )}>
                                            {entry.outcome}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4 text-slate-300 text-xs">{entry.policy.policyId}</td>
                                    <td className="py-3 pr-4 text-cyan-300 font-mono text-xs">{shortHash(entry.inputHash)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
