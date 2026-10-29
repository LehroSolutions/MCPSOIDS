"use client";

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { jsonRpcCall } from '../lib/mcp-client';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export function ChatConsole() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init',
            role: 'assistant',
            content: "MCP command bridge initialized. Use the tool catalog below for governed execution against the active reference server.",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await jsonRpcCall<string>('tools/call', {
                name: '__echo',
                arguments: {
                    message: userMsg.content,
                }
            });

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Echo verified through governed MCP gateway: ${response}`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `[SYSTEM ERROR] Failed to communicate with Neural Core: ${err instanceof Error ? err.message : String(err)}`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-panel rounded-2xl p-6 mt-8 border border-white/10 bg-black/40 backdrop-blur-xl relative overflow-hidden flex flex-col h-[600px]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                    <h3 className="font-bold text-white tracking-wide">MCP BRIDGE</h3>
                    <p className="text-xs text-slate-500 font-mono">Same-origin gateway // CSRF protected</p>
                </div>
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 pr-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${msg.role === 'assistant'
                                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                                : 'bg-slate-700/50 border-white/10 text-slate-300'
                            }`}>
                            {msg.role === 'assistant' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                        </div>

                        <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`p-4 rounded-2xl border backdrop-blur-md ${msg.role === 'assistant'
                                    ? 'bg-indigo-950/30 border-indigo-500/20 text-indigo-100 rounded-tl-none'
                                    : 'bg-slate-800/50 border-white/10 text-slate-200 rounded-tr-none'
                                }`}>
                                <p className="leading-relaxed whitespace-pre-wrap font-light">{msg.content}</p>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-2 font-mono px-1">
                                {msg.timestamp.toLocaleTimeString()}
                            </span>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
                            <Bot className="w-5 h-5 text-indigo-400 animate-pulse" />
                        </div>
                        <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 rounded-tl-none flex items-center gap-2">
                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="mt-6 pt-4 border-t border-white/5 relative">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Command the system (e.g., 'What is the status of the flagship project?')"
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-4 pr-12 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-light"
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
