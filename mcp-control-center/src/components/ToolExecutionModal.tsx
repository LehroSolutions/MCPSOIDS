"use client";

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { X, Play, AlertTriangle, CheckCircle, Loader2, Terminal } from 'lucide-react';
import { jsonRpcCall } from '../lib/mcp-client';
import { validateArgs } from '../lib/tool-validation';
import { clsx } from 'clsx';
import { ExecutionRecord } from './ExecutionHistory';
import { useHydrated } from '../lib/use-hydrated';

type SchemaProperty = {
    type?: string | string[];
    enum?: unknown[];
    default?: unknown;
    description?: string;
    maxLength?: number;
    maximum?: number;
    minimum?: number;
};

type ToolInputSchema = {
    type?: string;
    properties?: Record<string, SchemaProperty>;
    required?: string[];
};

type ToolDefinition = {
    name: string;
    description?: string;
    inputSchema?: ToolInputSchema;
};

type ToolExecutionModalProps = {
    tool: ToolDefinition | null;
    onClose: () => void;
    onExecutionComplete?: (record: Omit<ExecutionRecord, 'id' | 'timestamp'>) => void;
};

type ValidationErrors = Record<string, string>;

export function ToolExecutionModal(props: ToolExecutionModalProps) {
    const hydrated = useHydrated();
    if (!hydrated || !props.tool) return null;
    return <ToolExecutionSession key={props.tool.name} {...props} tool={props.tool} />;
}

function ToolExecutionSession({ tool, onClose, onExecutionComplete }: Omit<ToolExecutionModalProps, 'tool'> & { tool: ToolDefinition }) {
    const active = useRef(true);
    useEffect(() => {
        active.current = true;
        return () => { active.current = false; };
    }, []);
    const [args, setArgs] = useState<Record<string, string>>({});
    const [result, setResult] = useState<unknown>(null);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [isExecuting, setIsExecuting] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    useEffect(() => {
        const previous = document.activeElement;
        document.getElementById('mcp-tool-dialog')?.focus();
        return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
    }, [tool]);

    const COOLDOWN_SECONDS = 2;

    const handleExecute = async () => {
        if (cooldown > 0) return;

        const validation = validateArgs(tool, args);
        setValidationErrors(validation.errors);
        if (!validation.valid) {
            setError('Fix the highlighted arguments before running this tool.');
            return;
        }

        setIsExecuting(true);
        setError(null);
        setResult(null);

        try {
            const res = await jsonRpcCall('tools/call', {
                name: tool.name,
                arguments: validation.data,
            });
            if (!active.current) return;
            setResult(res);

            onExecutionComplete?.({
                toolName: tool.name,
                args: validation.data,
                result: res,
                error: null,
            });
        } catch (err) {
            if (!active.current) return;
            const errorMsg = err instanceof Error ? err.message : 'Execution failed';
            setError(errorMsg);

            onExecutionComplete?.({
                toolName: tool.name,
                args: validation.data,
                result: null,
                error: errorMsg,
            });
        } finally {
            if (active.current) {
                setIsExecuting(false);
                setCooldown(COOLDOWN_SECONDS);
            }
        }
    };

    const properties = tool.inputSchema?.properties || {};

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            />

            <div
                id="mcp-tool-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mcp-tool-title"
                tabIndex={-1}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
                    if (event.key !== 'Tab') return;
                    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'));
                    const first = elements[0];
                    const last = elements[elements.length - 1];
                    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
                    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
                }}
                className="relative z-10 w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="p-6 border-b border-white/10 flex items-start justify-between bg-slate-900/50">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                                <Terminal className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h2 id="mcp-tool-title" className="text-xl font-bold text-white font-mono">{tool.name}</h2>
                        </div>
                        <p className="text-slate-400 text-sm">{tool.description || "No description provided."}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    {Object.keys(properties).length > 0 ? (
                        <div className="space-y-4">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Arguments</div>
                            {Object.entries(properties).map(([key, schema]) => (
                                <div key={key} className="group">
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5 font-mono" htmlFor={`input-${key}`}>
                                        {key}
                                        {tool.inputSchema?.required?.includes(key) && <span className="text-red-400 ml-1">*</span>}
                                    </label>
                                    <input
                                        type="text"
                                        name={key}
                                        id={`input-${key}`}
                                        placeholder={schema.description || `Enter ${key}...`}
                                        className={clsx(
                                            "w-full bg-black/40 border rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-1 transition-all font-mono text-sm placeholder:text-slate-700",
                                            validationErrors[key]
                                                ? "border-red-500/60 focus:border-red-400 focus:ring-red-500/50"
                                                : "border-white/10 focus:border-emerald-500/50 focus:ring-emerald-500/50"
                                        )}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setArgs(prev => ({ ...prev, [key]: value }));
                                            setValidationErrors(prev => {
                                                const next = { ...prev };
                                                delete next[key];
                                                return next;
                                            });
                                        }}
                                        value={args[key] || ''}
                                        autoComplete="off"
                                        aria-invalid={Boolean(validationErrors[key])}
                                        aria-describedby={validationErrors[key] ? `error-${key}` : undefined}
                                    />
                                    {validationErrors[key] ? (
                                        <p id={`error-${key}`} className="mt-1 text-xs text-red-300">{validationErrors[key]}</p>
                                    ) : schema.description ? (
                                        <p className="mt-1 text-xs text-slate-600 group-focus-within:text-slate-500 transition-colors">{schema.description}</p>
                                    ) : null}
                                </div>
                            ))}
                            {validationErrors._form && (
                                <div className="text-xs text-red-300">{validationErrors._form}</div>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 bg-slate-800/30 rounded-lg text-slate-400 text-sm italic border border-white/5">
                            No arguments required for this tool.
                        </div>
                    )}

                    {(result || error) && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                                <span>Execution Result</span>
                                {error ? (
                                    <span className="text-red-400 text-[10px] flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> FAILED</span>
                                ) : (
                                    <span className="text-emerald-400 text-[10px] flex items-center gap-1"><CheckCircle className="w-3 h-3" /> SUCCESS</span>
                                )}
                            </div>
                            <div className={clsx(
                                "p-4 rounded-lg font-mono text-sm overflow-x-auto border",
                                error
                                    ? "bg-red-950/20 border-red-500/30 text-red-200"
                                    : "bg-black/60 border-emerald-500/20 text-emerald-100 shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)]"
                            )}>
                                <pre>{error ? error : JSON.stringify(result, null, 2)}</pre>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/10 bg-slate-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium text-sm"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleExecute}
                        disabled={isExecuting || cooldown > 0}
                        className={clsx(
                            "px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all shadow-lg min-w-[120px] justify-center",
                            isExecuting || cooldown > 0
                                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                : "bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/20 active:scale-95"
                        )}
                    >
                        {isExecuting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Executing...
                            </>
                        ) : cooldown > 0 ? (
                            <>Wait {cooldown}s</>
                        ) : (
                            <>
                                <Play className="w-4 h-4 fill-current" />
                                Run Tool
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
