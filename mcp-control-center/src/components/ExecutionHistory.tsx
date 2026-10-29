"use client";

import { History, CheckCircle, XCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';

export interface ExecutionRecord {
    id: string;
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
    error: string | null;
    timestamp: Date;
}

interface ExecutionHistoryProps {
    records: ExecutionRecord[];
}

export function ExecutionHistory({ records }: ExecutionHistoryProps) {
    if (records.length === 0) {
        return (
            <div className="glass-panel rounded-2xl p-6 mt-8">
                <h2 className="text-lg font-bold flex items-center gap-2 text-white mb-4">
                    <History className="w-5 h-5 text-slate-400" />
                    Execution History
                </h2>
                <p className="text-slate-500 text-sm italic">No executions yet. Run a tool to see history.</p>
            </div>
        );
    }

    return (
        <div className="glass-panel rounded-2xl p-6 mt-8">
            <h2 className="text-lg font-bold flex items-center gap-2 text-white mb-4">
                <History className="w-5 h-5 text-violet-400" />
                Execution History
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-slate-400 ml-auto">
                    {records.length} {records.length === 1 ? 'entry' : 'entries'}
                </span>
            </h2>

            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                {records.map((record) => (
                    <div
                        key={record.id}
                        className={clsx(
                            "p-4 rounded-xl border transition-all",
                            record.error
                                ? "bg-red-950/20 border-red-500/20"
                                : "bg-emerald-950/20 border-emerald-500/20"
                        )}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                {record.error ? (
                                    <XCircle className="w-4 h-4 text-red-400" />
                                ) : (
                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                )}
                                <span className="font-mono font-bold text-sm text-white">
                                    {record.toolName}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Clock className="w-3 h-3" />
                                {record.timestamp.toLocaleTimeString()}
                            </div>
                        </div>

                        {Object.keys(record.args).length > 0 && (
                            <div className="text-xs text-slate-400 font-mono mb-2">
                                Args: {JSON.stringify(record.args)}
                            </div>
                        )}

                        <div className={clsx(
                            "text-xs font-mono p-2 rounded bg-black/30 overflow-x-auto",
                            record.error ? "text-red-300" : "text-emerald-300"
                        )}>
                            <pre className="whitespace-pre-wrap">
                                {record.error || JSON.stringify(record.result, null, 2)}
                            </pre>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
