"use client";

import { useState, useCallback } from 'react';
import { ToolCatalog } from './ToolCatalog';
import { ExecutionHistory, ExecutionRecord } from './ExecutionHistory';
import { ChatConsole } from './ChatConsole';
import { AuditPanel } from './AuditPanel';
import { OperatorSession } from './OperatorSession';

const MAX_HISTORY_ENTRIES = 10;

export function Dashboard() {
    const [executionHistory, setExecutionHistory] = useState<ExecutionRecord[]>([]);
    const [sessionVersion, setSessionVersion] = useState(0);

    const sessionChanged = () => {
        setSessionVersion((version) => version + 1);
        setExecutionHistory([]);
    };

    const addExecution = useCallback((record: Omit<ExecutionRecord, 'id' | 'timestamp'>) => {
        const newRecord: ExecutionRecord = {
            ...record,
            id: crypto.randomUUID(),
            timestamp: new Date(),
        };

        setExecutionHistory(prev => [newRecord, ...prev].slice(0, MAX_HISTORY_ENTRIES));
    }, []);

    return (
        <>
            <OperatorSession onSessionChange={sessionChanged} />
            <ChatConsole key={`chat-${sessionVersion}`} />
            <ToolCatalog key={`tools-${sessionVersion}`} onExecutionComplete={addExecution} />
            <ExecutionHistory records={executionHistory} />
            <AuditPanel key={`audit-${sessionVersion}`} />
        </>
    );
}
