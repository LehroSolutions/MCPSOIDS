"use client";

import { useState } from 'react';
import { useHydrated } from '../lib/use-hydrated';
import { KeyRound, LogOut } from 'lucide-react';
import { clearOperatorToken, endOperatorSession, fetchHealth, setOperatorToken } from '../lib/mcp-client';

export function OperatorSession({ onSessionChange }: { onSessionChange?: () => void }) {
    const [token, setToken] = useState('');
    const [status, setStatus] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const ready = useHydrated();

    const unlock = async () => {
        if (!token.trim()) return;
        setBusy(true);
        setStatus(null);
        setOperatorToken(token.trim());
        try {
            await fetchHealth();
            clearOperatorToken();
            setStatus('Operator session active');
            setToken('');
            onSessionChange?.();
        } catch (err) {
            clearOperatorToken();
            setStatus(err instanceof Error ? err.message : 'Unable to create operator session');
        } finally {
            setBusy(false);
        }
    };

    const lock = async () => {
        setBusy(true);
        try {
            await endOperatorSession();
            setStatus('Operator session ended');
            onSessionChange?.();
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to end session');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="glass-panel rounded-2xl p-4 mt-8 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <KeyRound className="w-4 h-4 text-cyan-300" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-white">Operator Session</h2>
                    <p className="text-xs text-slate-500 font-mono">Required when production admin auth is enabled</p>
                </div>
            </div>
            <div className="flex flex-1 gap-2 md:justify-end">
                <input
                    type="password"
                    disabled={!ready}
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && unlock()}
                    placeholder="Admin token"
                    aria-label="Admin token"
                    className="min-w-0 flex-1 md:max-w-xs bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-400/60"
                    autoComplete="off"
                />
                <button
                    onClick={unlock}
                    disabled={busy || !token.trim()}
                    className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-bold"
                >
                    Unlock
                </button>
                <button
                    onClick={lock}
                    disabled={busy}
                    className="p-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white"
                    aria-label="End operator session"
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
            {status && <div role="status" className="text-xs text-slate-400 font-mono md:w-56">{status}</div>}
        </section>
    );
}
