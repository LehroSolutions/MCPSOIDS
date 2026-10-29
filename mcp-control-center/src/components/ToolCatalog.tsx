"use client";

import { useEffect, useState } from 'react';
import { jsonRpcCall } from '../lib/mcp-client';
import { Terminal, Database, Play } from 'lucide-react';
import { ToolExecutionModal } from './ToolExecutionModal';
import { ExecutionRecord } from './ExecutionHistory';

export type ToolDefinition = {
    name: string;
    description?: string;
    inputSchema?: {
        properties?: Record<string, {
            type?: string | string[];
            enum?: unknown[];
            default?: unknown;
            description?: string;
            maxLength?: number;
            maximum?: number;
            minimum?: number;
        }>;
        required?: string[];
    };
};

interface ToolCatalogProps {
    onExecutionComplete?: (record: Omit<ExecutionRecord, 'id' | 'timestamp'>) => void;
}

export function ToolCatalog({ onExecutionComplete }: ToolCatalogProps) {
    const [tools, setTools] = useState<ToolDefinition[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);

    useEffect(() => {
        jsonRpcCall<{ tools: ToolDefinition[] }>('tools/list')
            .then(res => {
                setTools(res.tools ?? []);
                setError(null);
            })
            .catch((e) => {
                setTools([]);
                setError(e instanceof Error ? e.message : 'Failed to load tools');
            });
    }, []);

    return (
        <div className="glass-panel rounded-2xl p-8 mt-8 border-t border-white/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay pointer-events-none" />

            <h2 className="text-xl font-bold flex items-center gap-3 text-white mb-6 relative z-10">
                <Database className="w-5 h-5 text-accent-secondary" aria-hidden="true" />
                <span className="tracking-tight">ACTIVE CAPABILITIES</span>
                <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-slate-400">{tools.length} AVAILABLE</span>
            </h2>

            {error && (
                <div role="alert" className="mb-6 text-sm text-red-300 font-mono">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                {tools.map((tool) => (
                    <div key={tool.name} className="group p-5 rounded-xl border border-white/5 bg-slate-900/40 hover:bg-slate-800/60 hover:border-accent-secondary/50 transition-all duration-300 relative overflow-hidden flex flex-col">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-slate-950 border border-white/10 group-hover:border-accent-secondary/50 transition-colors">
                                <Terminal className="w-5 h-5 text-slate-400 group-hover:text-accent-secondary" aria-hidden="true" />
                            </div>
                            <h3 className="font-bold text-slate-200 font-mono text-lg group-hover:text-white transition-colors">{tool.name}</h3>
                        </div>

                        {tool.description && (
                            <p className="text-sm text-slate-400 leading-relaxed mb-4 flex-1">{tool.description}</p>
                        )}

                        <div className="mt-4">
                            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Input Schema</div>
                            <div className="text-xs bg-black/50 p-3 rounded-lg border border-white/5 text-emerald-400 font-mono overflow-x-auto mb-4">
                                <span className="opacity-50">{"{"}</span>
                                {Object.keys(tool.inputSchema?.properties ?? {}).map((prop, i, all) => (
                                    <span key={prop} className="mx-1">
                                        <span className="text-purple-300">{prop}</span>
                                        {i < all.length - 1 && ","}
                                    </span>
                                ))}
                                <span className="opacity-50">{"}"}</span>
                            </div>

                            <button
                                onClick={() => setSelectedTool(tool)}
                                aria-label={`Interactive Run ${tool.name}`}
                                className="w-full py-2 bg-white/5 hover:bg-accent-secondary/20 border border-white/5 hover:border-accent-secondary/50 rounded-lg text-sm font-medium text-slate-300 hover:text-accent-secondary transition-all flex items-center justify-center gap-2 group/btn"
                            >
                                <Play className="w-3 h-3 fill-current group-hover/btn:scale-110 transition-transform" />
                                Interactive Run
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <ToolExecutionModal
                tool={selectedTool}
                onClose={() => setSelectedTool(null)}
                onExecutionComplete={onExecutionComplete}
            />
        </div>
    );
}
